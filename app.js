// Application Logic for CSE Study Portal

// App States
let currentView = 'dashboard';
let currentYear = 0;
let currentSem = 0;
let currentSubject = 0;
let activeNotesKey = '';

// Local Storage Keys
const LS_PROGRESS = 'cse_portal_progress';
const LS_BOOKMARKS = 'cse_portal_bookmarks';
const LS_NOTES = 'cse_portal_notes';
const LS_THEME = 'cse_portal_theme';
const LS_RECENT = 'cse_portal_recent';
const LS_AUTH = 'cse_portal_auth';
const LS_CLEARED_QUIZZES = 'cse_portal_cleared_quizzes';

// Load initial states from LocalStorage or defaults
let progressState = JSON.parse(localStorage.getItem(LS_PROGRESS)) || {};
let bookmarksState = JSON.parse(localStorage.getItem(LS_BOOKMARKS)) || [];
let notesState = JSON.parse(localStorage.getItem(LS_NOTES)) || {};
let recentActivity = JSON.parse(localStorage.getItem(LS_RECENT)) || [];
let authUser = localStorage.getItem(LS_AUTH) || null;
let authUsername = localStorage.getItem('cse_portal_auth_username') || null;
let clearedQuizzesState = JSON.parse(localStorage.getItem(LS_CLEARED_QUIZZES)) || {};

// Pomodoro Timer Variables
let timerInterval = null;
let timerMinutes = 25;
let timerSeconds = 0;
let timerMode = 'work'; // work, short, long
let isTimerRunning = false;

// --- Razorpay Payment Logic ---
const RAZORPAY_KEY_ID = 'rzp_live_StslEhMPMwafBq';

function triggerSplashSequence(isPaid, callback) {
    switchView('splash');
    
    const paymentText = document.getElementById('splash-payment-text');
    if (paymentText) {
        paymentText.style.display = 'block';
    }
    
    setTimeout(() => {
        if (callback) {
            callback();
        } else {
            if (isPaid || authUsername === 'demo') {
                switchView('dashboard');
            }
        }
    }, 5000);
}

function proceedToDashboard() {
    const paidAccessKey = 'rp_paid_access_' + authUsername;
    const hasPaidAccess = localStorage.getItem(paidAccessKey);
    const isPaid = (hasPaidAccess || authUsername === 'demo');
    
    triggerSplashSequence(isPaid, () => {
        if (isPaid) {
            switchView('dashboard');
        } else {
            const options = {
                key: RAZORPAY_KEY_ID,
                amount: 4900, // 49 INR in paise
                currency: "INR",
                name: "CSE Study Portal",
                description: "Website Access Fee",
                image: "osmania_logo_black.png",
                handler: function (response) {
                    // Payment successful
                    localStorage.setItem(paidAccessKey, 'true');
                    switchView('dashboard');
                },
                prefill: {
                    name: authUser || "",
                },
                theme: {
                    color: "#10b981"
                },
                modal: {
                    ondismiss: function() {
                        logout();
                    }
                }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                alert("Payment failed: " + response.error.description);
                logout();
            });
            rzp.open();
        }
    });
}



// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set theme
    const savedTheme = localStorage.getItem(LS_THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Check if data is loaded
    if (typeof cseAcademicData === 'undefined') {
        console.error("Academic database (data.js) is not loaded.");
        return;
    }

    if (authUser) {
        initializeAppForUser();
        const welcomeHeading = document.getElementById('dashboard-welcome');
        if (welcomeHeading) {
            welcomeHeading.textContent = `Welcome back, ${authUser}`;
        }
        proceedToDashboard();
    } else {
        switchView('login');
    }

    // Bind event listeners for search
    document.getElementById('search-bar').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
});

function initializeAppForUser() {
    if (authUsername === 'demo') {
        let demoCleared = JSON.parse(localStorage.getItem(LS_CLEARED_QUIZZES)) || {};
        [0, 1, 2, 3, 4, 5, 6, 7].forEach(semIdx => {
            if (cseAcademicData[semIdx]) {
                cseAcademicData[semIdx].subjects.forEach((subj, subjIdx) => {
                    demoCleared[`${semIdx}-${subjIdx}`] = true;
                });
            }
        });
        localStorage.setItem(LS_CLEARED_QUIZZES, JSON.stringify(demoCleared));
        clearedQuizzesState = demoCleared;
    }

    updateDashboardStats();
    renderSemesterProgressBars();
    renderRecentActivity();
    updateTotalSubjectsCount();
}

// View Switcher
function switchView(viewId) {
    currentView = viewId;
    
    // Toggle active classes on sidebar menu
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (viewId === 'dashboard') {
        document.getElementById('menu-dashboard').classList.add('active');
        updateDashboardStats();
        renderSemesterProgressBars();
        renderRecentActivity();
    } else if (viewId === 'bookmarks') {
        document.getElementById('menu-bookmarks').classList.add('active');
        renderBookmarks();
    } else if (viewId === 'workshop') {
        document.getElementById('menu-workshop').classList.add('active');
        renderWorkshopView();
    }
    
    // Toggle active page view
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }

    if (viewId === 'login') {
        document.querySelector('.app-container').style.display = 'none';
        document.getElementById('login-view').style.display = 'flex';
        return;
    }

    document.querySelector('.app-container').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';

    // Hide chapters subview inside courseware
    if (viewId !== 'courseware') {
        document.getElementById('subjects-grid').style.display = 'grid';
        document.getElementById('subject-chapters-view').classList.remove('active');
        document.getElementById('semester-header-section').style.display = 'block';
    }

    // Clear search bar if not in search view
    if (viewId !== 'search') {
        document.getElementById('search-bar').value = '';
    }

    // Auto-scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

// Sidebar Dropdown Toggle
function toggleYearDropdown(yearId) {
    const dropdown = document.getElementById(yearId);
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Semester Selection
function selectSemester(yearIndex, semIndex, titleText) {
    currentYear = yearIndex;
    currentSem = semIndex;

    // Toggle active state in sidebar semesters
    document.querySelectorAll('.sem-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeSemItem = document.querySelector(`.sem-item[data-year="${yearIndex}"][data-sem="${semIndex}"]`);
    if (activeSemItem) {
        activeSemItem.classList.add('active');
        
        // Ensure parent is open
        const parentDropdown = activeSemItem.closest('.year-dropdown');
        if (parentDropdown && !parentDropdown.classList.contains('open')) {
            parentDropdown.classList.add('open');
        }
    }

    // Set headings
    document.getElementById('courseware-title').textContent = titleText;
    const semesterData = cseAcademicData[yearIndex].subjects;
    document.getElementById('courseware-subtitle').textContent = `Syllabus for R22 Computer Science & Engineering (${semesterData.length} Subjects)`;

    // Render grid
    renderSubjectsGrid();

    // Switch view
    switchView('courseware');
}

// Count total subjects in syllabus
function updateTotalSubjectsCount() {
    let count = 0;
    cseAcademicData.forEach(year => {
        // year can contain subjects directly or semesters
        // Wait, the parsed JSON format structure is:
        // [ { name: "I YEAR - I SEMESTER (R22 CSE)", subjects: [ ... ] }, ... ]
        // So each element of the top array is actually a Semester!
        // Let's verify: Yes, parsed JSON array has 8 semesters.
        // Let's count subjects across all semesters.
    });
    const totalCount = cseAcademicData.reduce((acc, sem) => acc + sem.subjects.length, 0);
    document.getElementById('stat-total-subjects').textContent = totalCount;
}

// Render subjects cards
function renderSubjectsGrid() {
    const grid = document.getElementById('subjects-grid');
    grid.innerHTML = '';
    grid.style.display = 'grid';
    document.getElementById('subject-chapters-view').classList.remove('active');
    document.getElementById('semester-header-section').style.display = 'block';

    const subjects = cseAcademicData[currentYear * 2 + currentSem]?.subjects || [];

    if (subjects.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No subjects found for this semester.</p></div>`;
        return;
    }

    subjects.forEach((subject, index) => {
        const totalUnits = subject.units.length;
        const completedUnits = countCompletedUnits(currentYear * 2 + currentSem, index, totalUnits);
        const percent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-card-header">
                <span class="subject-code-tag">Subject ${index + 1}</span>
                <h3 class="subject-title">${subject.name}</h3>
            </div>
            <div class="subject-progress-box">
                <div class="subject-progress-text">
                    <span>${completedUnits}/${totalUnits} Units Completed</span>
                    <span class="percent">${percent}%</span>
                </div>
                <div class="subject-progress-bar-wrapper">
                    <div class="subject-progress-bar" style="width: ${percent}%;"></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="subject-view-btn" onclick="openSubjectChapters(${index})" style="flex: 1;">
                        <i class="fa-solid fa-folder-open"></i> Explore
                    </button>
                    <button class="subject-view-btn" onclick="startSubjectQuiz(${index})" style="flex: 1; border-color: rgba(99, 102, 241, 0.3); color: var(--accent-indigo);">
                        <i class="fa-solid fa-award"></i> Take Quiz
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Count completed units for a subject
function countCompletedUnits(semIndex, subjIndex, totalUnits) {
    let count = 0;
    for (let i = 0; i < totalUnits; i++) {
        const key = `${semIndex}-${subjIndex}-${i}`;
        if (progressState[key]) {
            count++;
        }
    }
    return count;
}

// Open chapters view for a subject
function openSubjectChapters(subjIndex) {
    currentSubject = subjIndex;
    const semIndex = currentYear * 2 + currentSem;
    const subject = cseAcademicData[semIndex].subjects[subjIndex];

    document.getElementById('semester-header-section').style.display = 'none';
    document.getElementById('subjects-grid').style.display = 'none';
    
    const chaptersView = document.getElementById('subject-chapters-view');
    chaptersView.classList.add('active');

    document.getElementById('chapter-subject-title').textContent = subject.name;
    document.getElementById('chapter-subject-desc').textContent = `${subject.units.length} Units • Curated Learning Tracks`;

    renderChaptersList();
}

function backToSubjects() {
    renderSubjectsGrid();
}

// Render chapters/units list
function extractYouTubeUrl(rawLink) {
    if (!rawLink) return '';

    const text = String(rawLink).trim();
    const directUrlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (!directUrlMatch) return '';

    return directUrlMatch[0].replace(/[),.;]+$/g, '');
}

function getEmbeddedVideoUrl(link) {
    const sourceUrl = extractYouTubeUrl(link);
    if (!sourceUrl) return '';

    try {
        const parsedUrl = new URL(sourceUrl);
        const hostname = parsedUrl.hostname.replace(/^www\./, '');

        if (hostname === 'youtu.be') {
            const videoId = parsedUrl.pathname.replace('/', '');
            return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
        }

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            const videoId = parsedUrl.searchParams.get('v');
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }

            const listId = parsedUrl.searchParams.get('list');
            if (listId) {
                return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
            }

            const searchQuery = parsedUrl.searchParams.get('search_query');
            if (searchQuery) {
                // YouTube deprecated embedding search results, which causes Error 153.
                // Return a special flag to open it in a new tab instead.
                return 'SEARCH_LINK';
            }

            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts[0] === 'embed' && pathParts[1]) {
                return `https://www.youtube.com/embed/${pathParts[1]}`;
            }
        }
    } catch (error) {
        console.warn('Unable to parse embedded video URL:', link);
    }

    return '';
}

function openEmbeddedVideo(semIndex, subjIndex, unitIndex, event) {
    if (event) {
        event.preventDefault();
    }

    const subject = cseAcademicData[semIndex].subjects[subjIndex];
    const unit = subject.units[unitIndex];
    const frameWrapper = document.querySelector('.video-frame-wrapper');
    const title = document.getElementById('video-modal-title');
    const subtitle = document.getElementById('video-modal-subtitle');
    const videoUrl = getEmbeddedVideoUrl(unit.link);

    if (videoUrl === 'SEARCH_LINK') {
        // Search embedding is blocked by YouTube, open directly in a new tab
        window.open(unit.link, '_blank');
        return;
    }

    if (!videoUrl) {
        alert('This topic does not currently have a playable embedded video URL.');
        return;
    }

    // Completely replace iframe to prevent Error 153 on reloads
    // Stripped restrictive 'allow' and 'referrerpolicy' attributes as they often break local file embeds
    frameWrapper.innerHTML = `<iframe id="embedded-video-frame" class="video-iframe" title="Embedded study video" src="${videoUrl}" allowfullscreen></iframe>`;
    
    title.textContent = `${subject.name} • ${unit.unit}`;
    subtitle.textContent = unit.chapter;
    document.getElementById('video-modal-overlay').classList.add('active');

    logStudyClick(semIndex, subjIndex, unitIndex);
}

function closeEmbeddedVideo(event) {
    if (event) {
        event.stopPropagation();
    }

    document.getElementById('video-modal-overlay').classList.remove('active');
    // Clear iframe from DOM completely to stop playback and prevent dirty state
    document.querySelector('.video-frame-wrapper').innerHTML = '';
}

function renderChaptersList() {
    const list = document.getElementById('chapters-list');
    list.innerHTML = '';

    const semIndex = currentYear * 2 + currentSem;
    const subject = cseAcademicData[semIndex].subjects[currentSubject];

    subject.units.forEach((unit, index) => {
        const key = `${semIndex}-${currentSubject}-${index}`;
        const isCompleted = !!progressState[key];
        const isBookmarked = isTopicBookmarked(semIndex, currentSubject, index);

        const item = document.createElement('div');
        item.className = 'chapter-item';
        item.innerHTML = `
            <div class="chapter-left">
                <div class="chapter-checkbox-wrapper">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleChapterProgress(${semIndex}, ${currentSubject}, ${index}, this)">
                    <div class="chapter-checkbox-design">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="chapter-details">
                    <div class="chapter-unit-tag">${unit.unit}</div>
                    <div class="chapter-title" title="${unit.chapter}">${unit.chapter}</div>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="chapter-action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${semIndex}, ${currentSubject}, ${index}, this)" title="Bookmark Topic">
                    <i class="fa-solid fa-bookmark"></i>
                </button>
                <button class="chapter-action-btn notes" onclick="openNotes('${key}', '${subject.name} - ${unit.unit}')" title="Scribble Study Notes">
                    <i class="fa-solid fa-pen-to-square"></i> Notes
                </button>
                <button type="button" class="chapter-action-btn youtube" onclick="openEmbeddedVideo(${semIndex}, ${currentSubject}, ${index}, event)">
                    <i class="fa-brands fa-youtube"></i> Watch
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Toggle chapter progress
function toggleChapterProgress(semIndex, subjIndex, unitIndex, checkbox) {
    const key = `${semIndex}-${subjIndex}-${unitIndex}`;
    progressState[key] = checkbox.checked;
    localStorage.setItem(LS_PROGRESS, JSON.stringify(progressState));

    // Update statistics
    updateDashboardStats();
    
    // If we clicked study from Quick Resume or search, we might not be in courseware view
    if (currentView === 'courseware' && document.getElementById('subjects-grid').style.display === 'grid') {
        renderSubjectsGrid();
    }
}

// Bookmarks Handling
function isTopicBookmarked(semIndex, subjIndex, unitIndex) {
    return bookmarksState.some(b => b.sem === semIndex && b.subj === subjIndex && b.unit === unitIndex);
}

function toggleBookmark(semIndex, subjIndex, unitIndex, button) {
    const subject = cseAcademicData[semIndex].subjects[subjIndex];
    const unit = subject.units[unitIndex];

    const idx = bookmarksState.findIndex(b => b.sem === semIndex && b.subj === subjIndex && b.unit === unitIndex);

    if (idx > -1) {
        // Remove
        bookmarksState.splice(idx, 1);
        button.classList.remove('bookmarked');
    } else {
        // Add
        bookmarksState.push({
            sem: semIndex,
            subj: subjIndex,
            unit: unitIndex,
            semesterName: cseAcademicData[semIndex].name,
            subjectName: subject.name,
            unitName: unit.unit,
            chapterName: unit.chapter,
            link: unit.link
        });
        button.classList.add('bookmarked');
    }

    localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarksState));
    updateDashboardStats();

    if (currentView === 'bookmarks') {
        renderBookmarks();
    }
}

function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    list.innerHTML = '';

    if (bookmarksState.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-bookmark"></i>
                <h4>No bookmarks yet</h4>
                <p>Bookmark important units within subject pages to view them here.</p>
            </div>
        `;
        return;
    }

    bookmarksState.forEach(b => {
        const key = `${b.sem}-${b.subj}-${b.unit}`;
        const isCompleted = !!progressState[key];

        const card = document.createElement('div');
        card.className = 'chapter-item';
        card.innerHTML = `
            <div class="chapter-left">
                <div class="chapter-checkbox-wrapper">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleChapterProgress(${b.sem}, ${b.subj}, ${b.unit}, this)">
                    <div class="chapter-checkbox-design">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="chapter-details">
                    <div class="chapter-unit-tag">${b.subjectName} • ${b.unitName}</div>
                    <div class="chapter-title" title="${b.chapterName}">${b.chapterName}</div>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="chapter-action-btn bookmark bookmarked" onclick="toggleBookmark(${b.sem}, ${b.subj}, ${b.unit}, this)" title="Remove Bookmark">
                    <i class="fa-solid fa-bookmark"></i>
                </button>
                <button class="chapter-action-btn notes" onclick="openNotes('${key}', '${b.subjectName} - ${b.unitName}')">
                    <i class="fa-solid fa-pen-to-square"></i> Notes
                </button>
                <button type="button" class="chapter-action-btn youtube" onclick="openEmbeddedVideo(${b.sem}, ${b.subj}, ${b.unit}, event)">
                    <i class="fa-brands fa-youtube"></i> Watch
                </button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderWorkshopView() {
    const list = document.getElementById('workshop-chapters-list');
    list.innerHTML = '';

    const workshopEntry = cseAcademicData.flatMap((sem, semIdx) =>
        sem.subjects.map((subj, subjIdx) => ({ semIdx, subjIdx, subject: subj }))
    ).find(entry => entry.subject.name.toLowerCase().includes('workshop'));

    if (!workshopEntry) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-hammer"></i>
                <h4>Workshop content not available</h4>
                <p>There is no workshop unit assigned yet. Please check back after the syllabus is updated.</p>
            </div>
        `;
        return;
    }

    const { semIdx, subjIdx, subject } = workshopEntry;
    subject.units.forEach((unit, unitIndex) => {
        const key = `${semIdx}-${subjIdx}-${unitIndex}`;
        const isCompleted = !!progressState[key];
        const isBookmarked = isTopicBookmarked(semIdx, subjIdx, unitIndex);

        const item = document.createElement('div');
        item.className = 'chapter-item';
        item.innerHTML = `
            <div class="chapter-left">
                <div class="chapter-checkbox-wrapper">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleChapterProgress(${semIdx}, ${subjIdx}, ${unitIndex}, this)">
                    <div class="chapter-checkbox-design">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="chapter-details">
                    <div class="chapter-unit-tag">${subject.name} • ${unit.unit}</div>
                    <div class="chapter-title" title="${unit.chapter}">${unit.chapter}</div>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="chapter-action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${semIdx}, ${subjIdx}, ${unitIndex}, this)" title="Bookmark Topic">
                    <i class="fa-solid fa-bookmark"></i>
                </button>
                <button class="chapter-action-btn notes" onclick="openNotes('${key}', '${subject.name} - ${unit.unit}')" title="Scribble Study Notes">
                    <i class="fa-solid fa-pen-to-square"></i> Notes
                </button>
                <button type="button" class="chapter-action-btn youtube" onclick="openEmbeddedVideo(${semIdx}, ${subjIdx}, ${unitIndex}, event)">
                    <i class="fa-brands fa-youtube"></i> Watch
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Notes Handling
function openNotes(key, title) {
    activeNotesKey = key;
    document.getElementById('notes-modal-title').textContent = 'Personal Study Notes';
    document.getElementById('notes-modal-subtitle').textContent = title;
    document.getElementById('notes-text').value = notesState[key] || '';
    document.getElementById('notes-modal-overlay').classList.add('active');
}

function saveNotes() {
    const text = document.getElementById('notes-text').value;
    if (text.trim() === '') {
        delete notesState[activeNotesKey];
    } else {
        notesState[activeNotesKey] = text;
    }
    localStorage.setItem(LS_NOTES, JSON.stringify(notesState));
    closeNotes();
}

function closeNotes() {
    document.getElementById('notes-modal-overlay').classList.remove('active');
}

// Log study clicks for recently opened items
function logStudyClick(semIndex, subjIndex, unitIndex) {
    const subject = cseAcademicData[semIndex].subjects[subjIndex];
    const unit = subject.units[unitIndex];

    // Remove existing if any
    recentActivity = recentActivity.filter(r => !(r.sem === semIndex && r.subj === subjIndex && r.unit === unitIndex));

    // Prepend new click
    recentActivity.unshift({
        sem: semIndex,
        subj: subjIndex,
        unit: unitIndex,
        subjectName: subject.name,
        unitName: unit.unit,
        chapterName: unit.chapter,
        link: unit.link,
        timestamp: Date.now()
    });

    // Cap at 4 items
    if (recentActivity.length > 4) {
        recentActivity.pop();
    }

    localStorage.setItem(LS_RECENT, JSON.stringify(recentActivity));
}

function renderRecentActivity() {
    const list = document.getElementById('resume-list');
    list.innerHTML = '';

    if (recentActivity.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 20px 0;">
                <p>No recent activity. Open embedded videos to begin studying!</p>
            </div>
        `;
        return;
    }

    recentActivity.forEach(r => {
        const item = document.createElement('div');
        item.className = 'resume-item';
        item.innerHTML = `
            <div class="resume-title-box">
                <div class="resume-subject">${r.subjectName} • ${r.unitName}</div>
                <div class="resume-chapter" title="${r.chapterName}">${r.chapterName}</div>
            </div>
            <button type="button" class="resume-play-btn" onclick="openEmbeddedVideo(${r.sem}, ${r.subj}, ${r.unit}, event)" title="Continue Studying">
                <i class="fa-solid fa-play"></i>
            </button>
        `;
        list.appendChild(item);
    });
}

// Reset Progress confirmation
function resetAllProgress() {
    if (confirm("Are you sure you want to reset all progress, bookmarks, notes, and study logs? This action cannot be undone.")) {
        localStorage.removeItem(LS_PROGRESS);
        localStorage.removeItem(LS_BOOKMARKS);
        localStorage.removeItem(LS_NOTES);
        localStorage.removeItem(LS_RECENT);
        localStorage.removeItem(LS_CLEARED_QUIZZES);
        localStorage.removeItem('cse_portal_auth_username');
        localStorage.removeItem('cse_portal_registered_users');
        progressState = {};
        bookmarksState = [];
        notesState = {};
        recentActivity = [];
        clearedQuizzesState = {};
        authUsername = null;
        updateDashboardStats();
        renderSemesterProgressBars();
        renderRecentActivity();
        switchView('dashboard');
        
        // Reload page to reset everything cleanly
        window.location.reload();
    }
}

function submitLogin(event) {
    event.preventDefault();
    const fullname = document.getElementById('login-fullname').value.trim();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');

    if (!fullname || !username || !password) {
        errorBox.textContent = 'Please enter your full name, username, and password.';
        return;
    }

    if (username.toLowerCase() === 'demo') {
        // Log in as demo
        authUser = fullname;
        authUsername = 'demo';
    } else {
        // Check registered users
        let registeredUsers = JSON.parse(localStorage.getItem('cse_portal_registered_users')) || [];
        const matchedUser = registeredUsers.find(user => user.username.toLowerCase() === username.toLowerCase());
        
        if (!matchedUser) {
            errorBox.textContent = 'Account not found. Please register first.';
            return;
        }
        
        if (matchedUser.password !== password) {
            errorBox.textContent = 'Incorrect password. Please try again.';
            return;
        }
        
        // Log in as matched user
        authUser = matchedUser.fullname;
        authUsername = matchedUser.username;
    }

    localStorage.setItem(LS_AUTH, authUser);
    localStorage.setItem('cse_portal_auth_username', authUsername);
    errorBox.textContent = '';
    document.getElementById('login-form').reset();
    
    const welcomeHeading = document.getElementById('dashboard-welcome');
    if (welcomeHeading) {
        welcomeHeading.textContent = `Welcome back, ${authUser}`;
    }
    
    initializeAppForUser();
    proceedToDashboard();
}

function checkPasswordStrength() {
    const password = document.getElementById('register-password').value;
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[@$!%*?&]/)) strength++;
    
    if (password.length === 0) {
        bar.style.width = '0%';
        text.textContent = 'Use 8+ chars with uppercase, numbers, and symbols.';
        text.style.color = 'var(--text-muted)';
        return;
    }
    
    if (strength === 1) {
        bar.style.width = '25%';
        bar.style.background = 'var(--accent-rose)';
        text.textContent = 'Weak password';
        text.style.color = 'var(--accent-rose)';
    } else if (strength === 2) {
        bar.style.width = '50%';
        bar.style.background = '#f59e0b';
        text.textContent = 'Fair password';
        text.style.color = '#f59e0b';
    } else if (strength === 3) {
        bar.style.width = '75%';
        bar.style.background = 'var(--accent-cyan)';
        text.textContent = 'Good password';
        text.style.color = 'var(--accent-cyan)';
    } else if (strength === 4) {
        bar.style.width = '100%';
        bar.style.background = 'var(--accent-emerald)';
        text.textContent = 'Strong password!';
        text.style.color = 'var(--accent-emerald)';
    }
}

function googleSignInMock() {
    // Mock a Google Authentication flow
    alert("Google Identity Services: Authenticating...");
    setTimeout(() => {
        // Log in the user automatically with a mock profile
        localStorage.setItem(LS_AUTH_USER, "Google User");
        localStorage.setItem(LS_AUTH_USERNAME, "googleuser123");
        
        // Hide auth screen and show main app
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('splash-view').classList.add('active');
        
        // Setup state
        authUser = "Google User";
        authUsername = "googleuser123";
        
        initializeAppForUser();
        document.getElementById('dashboard-welcome').textContent = `Welcome back, ${authUser}`;
        
        // Handle splash screen sequence
        const rpPaidKey = 'rp_paid_' + authUsername;
        const isPaid = localStorage.getItem(rpPaidKey) === 'true';
        triggerSplashSequence(isPaid);
    }, 1000);
}

function submitRegister(event) {
    event.preventDefault();
    const fullname = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const errorBox = document.getElementById('register-error');
    
    if (!fullname || !username || !password) {
        errorBox.textContent = 'Please fill in all fields.';
        return;
    }
    
    if (username.toLowerCase() === 'demo') {
        errorBox.textContent = 'The username "demo" is reserved. Please choose another username.';
        return;
    }
    
    // Strict password policy validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        errorBox.textContent = 'Password is not strong enough. Use 8+ characters, an uppercase letter, a number, and a symbol.';
        return;
    }
    
    let registeredUsers = JSON.parse(localStorage.getItem('cse_portal_registered_users')) || [];
    
    // Check if user already exists
    const userExists = registeredUsers.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (userExists) {
        errorBox.textContent = 'Username already registered. Please login or choose a different one.';
        return;
    }

    // Trigger Splash Screen and then Razorpay BEFORE saving user
    triggerSplashSequence(false, () => {
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: 4900, // 49 INR
            currency: "INR",
            name: "CSE Study Portal",
            description: "Website Access Fee (Registration)",
            image: "osmania_logo_black.png",
            handler: function (response) {
                // Payment successful, save new user
                registeredUsers.push({ fullname, username, password });
                localStorage.setItem('cse_portal_registered_users', JSON.stringify(registeredUsers));
                
                // Auto login
                authUser = fullname;
                authUsername = username;
                localStorage.setItem(LS_AUTH, authUser);
                localStorage.setItem('cse_portal_auth_username', authUsername);
                const paidAccessKey = 'rp_paid_access_' + authUsername;
                localStorage.setItem(paidAccessKey, 'true');
                
                errorBox.textContent = '';
                document.getElementById('register-form').reset();
                
                const welcomeHeading = document.getElementById('dashboard-welcome');
                if (welcomeHeading) {
                    welcomeHeading.textContent = `Welcome, ${authUser}`;
                }
                
                initializeAppForUser();
                switchView('dashboard');
            },
            prefill: {
                name: fullname || "",
            },
            theme: {
                color: "#10b981"
            },
            modal: {
                ondismiss: function() {
                    errorBox.textContent = 'Registration cancelled. Payment is required to register.';
                    switchView('login');
                }
            }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert("Payment failed: " + response.error.description);
            errorBox.textContent = 'Registration failed due to payment failure.';
            switchView('login');
        });
        rzp.open();
    });
}

function toggleAuthForm(mode) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTitle = document.querySelector('.login-title');
    const loginDesc = document.querySelector('.login-description');
    
    if (!loginForm || !registerForm) return;

    if (mode === 'register') {
        loginForm.style.animation = 'fadeOut 0.25s forwards';
        setTimeout(() => {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            registerForm.style.animation = 'fadeIn 0.25s forwards';
            if (loginTitle) loginTitle.textContent = "Create Account";
            if (loginDesc) loginDesc.textContent = "Register to start tracking your syllabus and progress.";
        }, 250);
    } else {
        registerForm.style.animation = 'fadeOut 0.25s forwards';
        setTimeout(() => {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            loginForm.style.animation = 'fadeIn 0.25s forwards';
            if (loginTitle) loginTitle.textContent = "Welcome Back";
            if (loginDesc) loginDesc.textContent = "Sign in to access your CSE study dashboard and workshop resources.";
        }, 250);
    }
}

function logout() {
    authUser = null;
    authUsername = null;
    localStorage.removeItem(LS_AUTH);
    localStorage.removeItem('cse_portal_auth_username');
    switchView('login');
}

// Search Logic
function handleSearch() {
    const query = document.getElementById('search-bar').value.trim().toLowerCase();
    
    if (query === '') {
        switchView('dashboard');
        return;
    }

    switchView('search');
    
    const resultsContainer = document.getElementById('search-results-list');
    resultsContainer.innerHTML = '';

    const results = [];

    // Search academic data
    cseAcademicData.forEach((sem, semIdx) => {
        sem.subjects.forEach((subj, subjIdx) => {
            // Check subject title match
            const subjMatch = subj.name.toLowerCase().includes(query);

            subj.units.forEach((unit, unitIdx) => {
                // Check unit chapter title or unit index match
                const chapterMatch = unit.chapter.toLowerCase().includes(query);
                const unitMatch = unit.unit.toLowerCase().includes(query);

                if (subjMatch || chapterMatch || unitMatch) {
                    results.push({
                        sem: semIdx,
                        subj: subjIdx,
                        unit: unitIdx,
                        semesterName: sem.name,
                        subjectName: subj.name,
                        unitName: unit.unit,
                        chapterName: unit.chapter,
                        link: unit.link,
                        // relevance score
                        score: (chapterMatch ? 3 : 0) + (subjMatch ? 1 : 0) + (unitMatch ? 1 : 0)
                    });
                }
            });
        });
    });

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);

    document.getElementById('search-results-summary').textContent = `Found ${results.length} matches for "${query}"`;

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <h4>No matching topics found</h4>
                <p>Try searching for core topics like "Calculus", "Algorithms", "DBMS", or "Pointers".</p>
            </div>
        `;
        return;
    }

    results.forEach(r => {
        const key = `${r.sem}-${r.subj}-${r.unit}`;
        const isCompleted = !!progressState[key];
        const isBookmarked = isTopicBookmarked(r.sem, r.subj, r.unit);

        const card = document.createElement('div');
        card.className = 'chapter-item';
        card.innerHTML = `
            <div class="chapter-left">
                <div class="chapter-checkbox-wrapper">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleChapterProgress(${r.sem}, ${r.subj}, ${r.unit}, this)">
                    <div class="chapter-checkbox-design">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="chapter-details">
                    <div class="chapter-unit-tag">${r.semesterName} • ${r.subjectName}</div>
                    <div class="chapter-title" title="${r.chapterName}">${r.unitName}: ${r.chapterName}</div>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="chapter-action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark(${r.sem}, ${r.subj}, ${r.unit}, this)">
                    <i class="fa-solid fa-bookmark"></i>
                </button>
                <button class="chapter-action-btn notes" onclick="openNotes('${key}', '${r.subjectName} - ${r.unitName}')">
                    <i class="fa-solid fa-pen-to-square"></i> Notes
                </button>
                <button type="button" class="chapter-action-btn youtube" onclick="openEmbeddedVideo(${r.sem}, ${r.subj}, ${r.unit}, event)">
                    <i class="fa-brands fa-youtube"></i> Watch
                </button>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

// Calculate Statistics
function updateDashboardStats() {
    let totalChaptersCount = 0;
    let completedChaptersCount = 0;

    // Count overall
    cseAcademicData.forEach((sem, semIdx) => {
        sem.subjects.forEach((subj, subjIdx) => {
            subj.units.forEach((unit, unitIdx) => {
                totalChaptersCount++;
                const key = `${semIdx}-${subjIdx}-${unitIdx}`;
                if (progressState[key]) {
                    completedChaptersCount++;
                }
            });
        });
    });

    const overallPercent = totalChaptersCount > 0 ? Math.round((completedChaptersCount / totalChaptersCount) * 100) : 0;

    document.getElementById('stat-completed-chapters').textContent = completedChaptersCount;
    document.getElementById('stat-overall-progress').textContent = `${overallPercent}%`;
    document.getElementById('stat-bookmarks-count').textContent = bookmarksState.length;
}

// Render Semester Progress List on Dashboard
function renderSemesterProgressBars() {
    const container = document.getElementById('semester-progress-list');
    container.innerHTML = '';

    cseAcademicData.forEach((sem, semIdx) => {
        let totalSemUnits = 0;
        let completedSemUnits = 0;

        sem.subjects.forEach((subj, subjIdx) => {
            subj.units.forEach((unit, unitIdx) => {
                totalSemUnits++;
                const key = `${semIdx}-${subjIdx}-${unitIdx}`;
                if (progressState[key]) {
                    completedSemUnits++;
                }
            });
        });

        const percent = totalSemUnits > 0 ? Math.round((completedSemUnits / totalSemUnits) * 100) : 0;
        
        // Map semester index to Year & Sem indexes for click navigation
        const yearIndex = Math.floor(semIdx / 2);
        const semInYear = semIdx % 2;

        const row = document.createElement('div');
        row.className = 'sem-progress-row';
        row.onclick = () => selectSemester(yearIndex, semInYear, sem.name);
        row.innerHTML = `
            <div class="sem-progress-label">${sem.name.replace(' (R22 CSE)', '')}</div>
            <div class="sem-progress-bar-wrapper">
                <div class="sem-progress-bar" style="width: ${percent}%;"></div>
            </div>
            <div class="sem-progress-percent">${percent}%</div>
        `;
        container.appendChild(row);
    });
}



// Pomodoro Timer Logic
function toggleTimer() {
    const playBtn = document.getElementById('timer-play-btn');
    
    if (isTimerRunning) {
        // Pause timer
        clearInterval(timerInterval);
        isTimerRunning = false;
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        playBtn.classList.remove('btn-secondary');
        playBtn.classList.add('btn-primary');
    } else {
        // Start timer
        isTimerRunning = true;
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        playBtn.classList.remove('btn-primary');
        playBtn.classList.add('btn-secondary');
        
        timerInterval = setInterval(() => {
            if (timerSeconds === 0) {
                if (timerMinutes === 0) {
                    // Timer Finished!
                    clearInterval(timerInterval);
                    isTimerRunning = false;
                    playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
                    playBtn.classList.remove('btn-secondary');
                    playBtn.classList.add('btn-primary');
                    
                    // Play Sound
                    const alarm = document.getElementById('alarm-sound');
                    if (alarm) {
                        alarm.play().catch(e => console.log('Audio playback block:', e));
                    }
                    
                    alert(timerMode === 'work' ? "Focus session complete! Time to take a short break." : "Break complete! Time to get back to studying.");
                    
                    // Switch modes automatically
                    if (timerMode === 'work') {
                        setTimerMode('short');
                    } else {
                        setTimerMode('work');
                    }
                    return;
                }
                timerMinutes--;
                timerSeconds = 59;
            } else {
                timerSeconds--;
            }
            updateTimerDisplay();
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    
    const playBtn = document.getElementById('timer-play-btn');
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
    playBtn.classList.remove('btn-secondary');
    playBtn.classList.add('btn-primary');

    // Reset default time based on mode
    if (timerMode === 'work') {
        timerMinutes = 25;
    } else if (timerMode === 'short') {
        timerMinutes = 5;
    } else {
        timerMinutes = 15;
    }
    timerSeconds = 0;
    updateTimerDisplay();
}

function setTimerMode(mode) {
    timerMode = mode;
    
    // Toggle active classes on buttons
    document.querySelectorAll('.timer-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');

    resetTimer();
}

function updateTimerDisplay() {
    const minStr = String(timerMinutes).padStart(2, '0');
    const secStr = String(timerSeconds).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${minStr}:${secStr}`;
}

// Theme Handling
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(LS_THEME, newTheme);
    
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    const loginIcon = document.getElementById('login-theme-icon');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-moon';
        } else {
            icon.className = 'fa-solid fa-sun';
        }
    }
    if (loginIcon) {
        if (theme === 'dark') {
            loginIcon.className = 'fa-solid fa-moon';
        } else {
            loginIcon.className = 'fa-solid fa-sun';
        }
    }
}

// Quiz Controller Logic
let activeQuizQuestions = [];
let userAnswers = [];
let currentQuizSubjectName = "";
let currentQuizSubjectIndex = 0;
let currentQuestionIndex = 0;
let selectedOptionIndex = null;
let correctAnswersCount = 0;
const GOOGLE_QUIZ_API_KEY = 'AIzaSyDpGOoFNKDmmgnXkQByUuL0-p0k4rlFlrI';

function shuffleArray(items) {
    const clonedItems = [...items];
    for (let i = clonedItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clonedItems[i], clonedItems[j]] = [clonedItems[j], clonedItems[i]];
    }
    return clonedItems;
}

const domainConcepts = {
    math: ["eigenvalues and eigenvectors", "derivatives and partial differentiation", "matrix multiplication and determinants", "triple integrals", "taylor series expansions"],
    chemistry: ["water hardness and EDTA titration", "polymerization and plastics", "galvanic cells and corrosion protection", "lead-acid battery chemistry", "engineering materials and lubricants"],
    programming: ["pointers and memory addresses", "class inheritance and method overriding", "structures and unions in C", "dynamic memory allocation using malloc", "preprocessor directives"],
    algorithms: ["time complexity and Big-O notation", "breadth-first and depth-first search", "balanced binary search trees", "Dijkstra's shortest path algorithm", "hash collisions and resolution"],
    dbms: ["relational database schemas", "SQL queries and joins", "ACID transaction properties", "3rd Normal Form (3NF)", "primary and foreign key constraints"],
    os: ["CPU process scheduling", "deadlock prevention conditions", "virtual memory paging", "semaphores and process synchronization", "context switching latency"],
    networks: ["OSI model layers", "TCP/IP handshake protocol", "IP routing and packet switching", "DNS domain resolution", "UDP connectionless delivery"],
    compiler: ["lexical analysis and token streams", "context-free grammars and parsers", "abstract syntax trees (AST)", "three-address intermediate code", "compiler code optimization"],
    web: ["DOM tree manipulation", "CSS flexbox and grid layouts", "asynchronous Javascript fetch", "HTTP request-response status codes", "client-side cookie storage"],
    ml: ["supervised learning algorithms", "gradient descent optimization", "overfitting and model generalization", "neural network activation functions", "precision, recall, and F1-score"],
    general: ["CPU cache memory levels", "binary and hexadecimal representations", "software development lifecycle phases", "boolean algebra simplification", "ALU operation cycles"]
};

const domainObjectives = {
    math: "Solving systems of linear equations and finding rates of change or volumes",
    chemistry: "Analyzing water purity, battery efficiency, and protective material coatings",
    programming: "Creating reusable, error-free instructions and managing system memory layout",
    algorithms: "Organizing data structures and optimizing execution time and storage memory",
    dbms: "Ensuring database consistency, schema normalization, and rapid query retrieval",
    os: "Managing hardware resources, memory space, and scheduling process execution",
    networks: "Enabling reliable data transmission, packet routing, and client-server connections",
    compiler: "Translating high-level source code into efficient machine-level executable instructions",
    web: "Building responsive layouts and fetching server-side resource payloads dynamically",
    ml: "Recognizing underlying data patterns and predicting target outcomes from training sets",
    general: "Understanding computer architecture operations and software engineering workflows"
};

const domainTerms = {
    math: ["Determinant", "Taylor Series", "Gradient", "Partial Derivative", "Eigenvalue"],
    chemistry: ["Titration", "Polymerization", "Anode", "Cathode", "Electrolyte"],
    programming: ["Pointer", "Class", "Override", "Recursion", "Format Specifier"],
    algorithms: ["Stack", "Hash Map", "Binary Tree", "Time Complexity", "Queue"],
    dbms: ["Foreign Key", "ACID", "Normalization", "Index", "Query Join"],
    os: ["Deadlock", "Semaphore", "Thrashing", "Virtual Memory", "Thread"],
    networks: ["IP Address", "Router", "Packet", "Port Number", "DNS"],
    compiler: ["Token", "Parser", "Syntax Tree", "Grammar", "Optimizer"],
    web: ["DOM", "Flexbox", "Callback", "Cookie", "HTTP Header"],
    ml: ["Overfitting", "Gradient Descent", "Supervised", "Activation Function", "Precision"],
    general: ["Register", "Cache", "Hexadecimal", "Boolean", "Instruction"]
};

function getDomainForChapter(subjectName, chapterName) {
    const combined = (subjectName + " " + chapterName).toLowerCase();
    
    if (combined.match(/(matrix|matrices|calculus|differentiation|integration|math|discrete|algebra|probability|statistics)/)) {
        return "math";
    }
    if (combined.match(/(chemistry|water|polymer|corrosion|battery|energy)/)) {
        return "chemistry";
    }
    if (combined.match(/(programming|c language|java|oops|object|class|inheritance|polymorphism)/)) {
        return "programming";
    }
    if (combined.match(/(structures|stack|queue|tree|graph|list|sort|search|algorithm|complexity|daa)/)) {
        return "algorithms";
    }
    if (combined.match(/(database|dbms|sql|schema|relation|query)/)) {
        return "dbms";
    }
    if (combined.match(/(operating system|os|process|thread|scheduling|deadlock|paging|semaphore)/)) {
        return "os";
    }
    if (combined.match(/(network|protocol|ip|routing|tcp|udp|dns)/)) {
        return "networks";
    }
    if (combined.match(/(compiler|parse|lexical|syntax|token|grammar)/)) {
        return "compiler";
    }
    if (combined.match(/(web|html|css|js|javascript|http)/)) {
        return "web";
    }
    if (combined.match(/(machine learning|ml|neural|intelligence|data science|regression|model)/)) {
        return "ml";
    }
    return "general";
}

function generateDynamicQuestionsForChapter(subjectName, chapterName, unitName) {
    const cleanSubj = subjectName.replace(/^\d+\.\s+/, '').trim();
    const cleanChapter = chapterName.trim();
    
    const domain = getDomainForChapter(cleanSubj, cleanChapter);
    
    const concepts = domainConcepts[domain] || domainConcepts.general;
    const terms = domainTerms[domain] || domainTerms.general;
    const objective = domainObjectives[domain] || domainObjectives.general;
    
    // Distractor domains
    const allDomains = Object.keys(domainConcepts).filter(d => d !== domain);
    const getDistractorConcepts = () => {
        const dists = [];
        const shuffledDomains = shuffleArray(allDomains);
        shuffledDomains.forEach(d => {
            const arr = domainConcepts[d];
            if (arr && arr.length > 0) {
                dists.push(arr[Math.floor(Math.random() * arr.length)]);
            }
        });
        return [...new Set(dists)].slice(0, 3);
    };
    
    const getDistractorTerms = () => {
        const dists = [];
        const shuffledDomains = shuffleArray(allDomains);
        shuffledDomains.forEach(d => {
            const arr = domainTerms[d];
            if (arr && arr.length > 0) {
                dists.push(arr[Math.floor(Math.random() * arr.length)]);
            }
        });
        return [...new Set(dists)].slice(0, 3);
    };
    
    const getDistractorObjectives = () => {
        const dists = [];
        const shuffledDomains = shuffleArray(allDomains);
        shuffledDomains.forEach(d => {
            const obj = domainObjectives[d];
            if (obj) {
                dists.push(obj);
            }
        });
        return [...new Set(dists)].slice(0, 3);
    };
    
    // Generate other subjects as distractors
    const allSubjects = [...new Set(cseAcademicData.flatMap(sem => sem.subjects.map(subj => subj.name.replace(/^\d+\.\s+/, '').trim())))].filter(s => s !== cleanSubj);
    const getDistractorSubjects = () => {
        return shuffleArray(allSubjects).slice(0, 3);
    };
    
    // Generate units distractors
    const getDistractorUnits = (correctUnit) => {
        const units = ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"].filter(u => u !== correctUnit);
        return shuffleArray(units).slice(0, 3);
    };

    const questions = [];
    
    // Q1: Concept definition
    const correctConcept = concepts[0];
    const distConcepts = getDistractorConcepts();
    const options1 = shuffleArray([correctConcept, ...distConcepts]);
    questions.push({
        q: `Which of the following is a primary concept or technique associated with the study of "${cleanChapter}"?`,
        o: options1,
        a: options1.indexOf(correctConcept)
    });
    
    // Q2: Subject Association
    const options2 = shuffleArray([cleanSubj, ...getDistractorSubjects()]);
    questions.push({
        q: `The chapter "${cleanChapter}" is an integral module of which subject in the B.Tech CSE syllabus?`,
        o: options2,
        a: options2.indexOf(cleanSubj)
    });
    
    // Q3: Unit Identification
    const options3 = shuffleArray([unitName, ...getDistractorUnits(unitName)]);
    questions.push({
        q: `In the course "${cleanSubj}", under which unit is the topic "${cleanChapter}" structured?`,
        o: options3,
        a: options3.indexOf(unitName)
    });
    
    // Q4: Objective Question
    const distObjs = getDistractorObjectives();
    const options4 = shuffleArray([objective, ...distObjs]);
    questions.push({
        q: `When studying "${cleanChapter}", which problem or objective are engineers typically trying to solve?`,
        o: options4,
        a: options4.indexOf(objective)
    });
    
    // Q5: Terminology Question
    const correctTerm = terms[0];
    const distTerms = getDistractorTerms();
    const options5 = shuffleArray([correctTerm, ...distTerms]);
    questions.push({
        q: `Which of the following terms is most commonly used in the context of "${cleanChapter}"?`,
        o: options5,
        a: options5.indexOf(correctTerm)
    });
    
    return questions;
}

function getQuestionsForChapter(subjectName, chapterName, unitName) {
    const cleanChapterName = chapterName.trim().toLowerCase();
    
    let questions = cseQuizzesData[cleanChapterName];
    if (!questions) {
        const matchingKey = Object.keys(cseQuizzesData).find(key =>
            cleanChapterName.includes(key) || key.includes(cleanChapterName)
        );
        if (matchingKey) {
            questions = cseQuizzesData[matchingKey];
        }
    }
    
    if (questions && questions.length > 0) {
        return JSON.parse(JSON.stringify(questions));
    }
    
    return generateDynamicQuestionsForChapter(subjectName, chapterName, unitName);
}

function getLocalQuizQuestionsForSubject(subjectName) {
    const semIndex = currentYear * 2 + currentSem;
    const subject = cseAcademicData[semIndex].subjects[currentSubject];
    
    const targetTotal = 20;
    const chaptersCount = subject ? subject.units.length : 0;
    
    if (chaptersCount === 0) {
        return [{
            q: `No quiz questions are available for ${subjectName} right now.`,
            o: ['Please try again later.', 'No data available.', 'Contact support.', 'Refresh the page.'],
            a: 0
        }];
    }
    
    const baseQty = Math.floor(targetTotal / chaptersCount);
    const remainder = targetTotal % chaptersCount;
    
    let allSubjectQuestions = [];
    subject.units.forEach((unit, unitIdx) => {
        let chapterQuestions = getQuestionsForChapter(subject.name, unit.chapter, unit.unit);
        chapterQuestions = shuffleArray(chapterQuestions);
        
        const qtyToTake = baseQty + (unitIdx < remainder ? 1 : 0);
        allSubjectQuestions.push(...chapterQuestions.slice(0, qtyToTake));
    });
    
    return shuffleArray(allSubjectQuestions);
}

async function fetchGoogleKnowledgeGraphFacts(searchTerm) {
    if (!GOOGLE_QUIZ_API_KEY) return null;
    try {
        const response = await fetch(`https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(searchTerm)}&key=${GOOGLE_QUIZ_API_KEY}&limit=4&indent=true`);
        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        const facts = [];
        if (result.itemListElement) {
            result.itemListElement.forEach(item => {
                const entity = item.result;
                if (entity.name) {
                    facts.push(entity.name);
                }
                if (entity.description) {
                    facts.push(entity.description);
                }
                if (entity.detailedDescription && entity.detailedDescription.articleBody) {
                    facts.push(entity.detailedDescription.articleBody);
                }
            });
        }
        return facts.filter(Boolean).slice(0, 5);
    } catch (error) {
        return null;
    }
}

function buildTopicQuizQuestions(subjectName, topicFacts) {
    const semIndex = currentYear * 2 + currentSem;
    const subject = cseAcademicData[semIndex].subjects[currentSubject];
    const subjectChapters = subject.units.map(entry => entry.chapter);

    const otherChapters = cseAcademicData.flatMap((sem, i) =>
        sem.subjects.flatMap(subj => subj.units.map(unit => unit.chapter))
    ).filter(chapter => !subjectChapters.includes(chapter));

    const uniqueOther = shuffleArray([...new Set(otherChapters)]).slice(0, 10);
    const questions = [];

    // Related unit recognition question
    if (subjectChapters.length >= 3) {
        const correct = subjectChapters[0];
        const distractors = uniqueOther.slice(0, 3);
        questions.push({
            q: `Which of the following chapters belongs to the subject "${subjectName}"?`,
            o: shuffleArray([correct, ...distractors]),
            a: null
        });
    }

    // Not a chapter question
    if (subjectChapters.length >= 4) {
        const correct = uniqueOther[0] || 'A related topic from another branch';
        const options = shuffleArray([...subjectChapters.slice(0, 3), correct]);
        questions.push({
            q: `Which one of these is NOT one of the chapters in "${subjectName}"?`,
            o: options,
            a: options.indexOf(correct)
        });
    }

    // Use first fact from Google Knowledge Graph if available
    if (topicFacts && topicFacts.length > 0) {
        const fact = topicFacts[0];
        questions.push({
            q: `Which statement best describes the topic "${subjectName}"?`,
            o: shuffleArray([
                fact,
                `A subject about unrelated engineering topics.`,
                `A history course focused on ancient civilizations.`,
                `A study of culinary and food preparation techniques.`
            ]),
            a: null
        });
    }

    // Create question from chapter names
    if (subjectChapters.length >= 2) {
        const correct = subjectChapters[1];
        const distractors = uniqueOther.slice(1, 4);
        const options = shuffleArray([correct, ...distractors]);
        questions.push({
            q: `In the subject "${subjectName}", which chapter most likely covers this topic?`,
            o: options,
            a: options.indexOf(correct)
        });
    }

    // Fill to five unique questions using unit-level prompts
    const questionSet = [];
    const usedQuestions = new Set();
    questions.forEach(question => {
        if (question.q && !usedQuestions.has(question.q) && question.o.length >= 2) {
            usedQuestions.add(question.q);
            questionSet.push(question);
        }
    });

    while (questionSet.length < 5 && subjectChapters.length > 0) {
        const chapterIndex = questionSet.length % subjectChapters.length;
        const correct = subjectChapters[chapterIndex];
        const distractors = uniqueOther.slice(questionSet.length * 2, questionSet.length * 2 + 3);
        const optionSet = shuffleArray([correct, ...distractors]);
        const q = `Which chapter title belongs to "${subjectName}"?`;
        if (!usedQuestions.has(q)) {
            usedQuestions.add(q);
            questionSet.push({ q, o: optionSet, a: optionSet.indexOf(correct) });
        } else {
            break;
        }
    }

    return questionSet.map(question => {
        if (question.a === null) {
            question.a = 0;
        }
        return question;
    });
}

async function createQuizQuestionsForSubject(subjectName) {
    return getLocalQuizQuestionsForSubject(subjectName);
}

// Start quiz from subject card
function startSubjectQuiz(subjIndex) {
    currentSubject = subjIndex;
    startQuizFlow();
}

// Start quiz from chapters view
function startSubjectQuizFromChapters() {
    startQuizFlow();
}

async function startQuizFlow() {
    const semIndex = currentYear * 2 + currentSem;
    const subject = cseAcademicData[semIndex].subjects[currentSubject];
    currentQuizSubjectIndex = currentSubject;
    currentQuizSubjectName = subject.name;

    // Reset states before generation
    currentQuestionIndex = 0;
    selectedOptionIndex = null;
    correctAnswersCount = 0;
    userAnswers = [];

    switchView('quiz');
    document.getElementById('quiz-subject-title').textContent = `${subject.name} - Assessment`;
    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('quiz-result-box').style.display = 'none';
    document.getElementById('quiz-question-text').textContent = 'Generating quiz questions for this topic...';
    document.getElementById('quiz-options-list').innerHTML = '';
    const actionBtn = document.getElementById('quiz-action-btn');
    actionBtn.disabled = true;
    actionBtn.innerHTML = 'Generating...';

    activeQuizQuestions = await createQuizQuestionsForSubject(subject.name);
    activeQuizQuestions = activeQuizQuestions.filter((q, index, self) =>
        index === self.findIndex(other => other.q === q.q)
    );

    if (!activeQuizQuestions.length) {
        activeQuizQuestions = getLocalQuizQuestionsForSubject(subject.name);
    }

    const totalQ = activeQuizQuestions.length;
    const passQty = Math.ceil(totalQ * 0.75);
    const scoreLiveEl = document.getElementById('quiz-score-live');
    if (scoreLiveEl) {
        scoreLiveEl.textContent = `75% to pass (${passQty}/${totalQ})`;
    }

    renderQuizQuestion();
}

function renderQuizQuestion() {
    const question = activeQuizQuestions[currentQuestionIndex];
    
    // Set progress
    const totalQ = activeQuizQuestions.length;
    document.getElementById('quiz-progress-text').textContent = `Question ${currentQuestionIndex + 1} of ${totalQ}`;
    const percent = Math.round(((currentQuestionIndex) / totalQ) * 100);
    document.getElementById('quiz-progress-bar').style.width = `${percent}%`;
    
    // Set question text
    document.getElementById('quiz-question-text').textContent = question.q;
    
    // Set options
    const optionsContainer = document.getElementById('quiz-options-list');
    optionsContainer.innerHTML = '';
    
    question.o.forEach((option, index) => {
        const optionCard = document.createElement('div');
        optionCard.className = 'quiz-option-card';
        optionCard.onclick = () => selectQuizOption(index);
        optionCard.innerHTML = `
            <div class="quiz-option-dot"></div>
            <div class="quiz-option-text">${option}</div>
        `;
        optionsContainer.appendChild(optionCard);
    });
    
    // Reset action button
    selectedOptionIndex = null;
    const actionBtn = document.getElementById('quiz-action-btn');
    actionBtn.disabled = true;
    actionBtn.innerHTML = currentQuestionIndex === totalQ - 1 ? 'Submit Answers <i class="fa-solid fa-check"></i>' : 'Next Question <i class="fa-solid fa-arrow-right"></i>';
}

function selectQuizOption(index) {
    selectedOptionIndex = index;
    
    // Highlight selected card
    const cards = document.querySelectorAll('.quiz-option-card');
    cards.forEach((card, idx) => {
        if (idx === index) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Enable action button
    document.getElementById('quiz-action-btn').disabled = false;
}

function submitAnswer() {
    if (selectedOptionIndex === null) return;
    
    const question = activeQuizQuestions[currentQuestionIndex];
    
    // Save selected answer index
    userAnswers.push(selectedOptionIndex);
    
    // Verify answer
    if (selectedOptionIndex === question.a) {
        correctAnswersCount++;
    }
    
    const totalQ = activeQuizQuestions.length;
    if (currentQuestionIndex < totalQ - 1) {
        // Go to next
        currentQuestionIndex++;
        renderQuizQuestion();
    } else {
        // Complete Quiz
        showQuizResults();
    }
}

function showQuizResults() {
    document.getElementById('quiz-container').style.display = 'none';
    const resultBox = document.getElementById('quiz-result-box');
    resultBox.style.display = 'block';
    
    const totalQ = activeQuizQuestions.length;
    const scorePercent = Math.round((correctAnswersCount / totalQ) * 100);
    
    document.getElementById('quiz-result-score').textContent = `You scored ${scorePercent}% (${correctAnswersCount}/${totalQ})`;
    
    // Generate Answers Review Section
    const reviewContainer = document.getElementById('quiz-answers-review');
    reviewContainer.innerHTML = '';
    
    activeQuizQuestions.forEach((q, idx) => {
        const userChoice = userAnswers[idx];
        const correctChoice = q.a;
        const isCorrect = userChoice === correctChoice;
        
        const card = document.createElement('div');
        card.className = `quiz-review-card ${isCorrect ? 'correct' : 'incorrect'}`;
        
        let optionsHtml = '';
        q.o.forEach((opt, optIdx) => {
            let optColor = 'var(--text-secondary)';
            let iconHtml = '';
            
            if (optIdx === correctChoice) {
                optColor = 'var(--accent-emerald)';
                iconHtml = '<i class="fa-solid fa-circle-check" style="margin-left: 8px;"></i>';
            } else if (optIdx === userChoice && !isCorrect) {
                optColor = 'var(--accent-rose)';
                iconHtml = '<i class="fa-solid fa-circle-xmark" style="margin-left: 8px;"></i>';
            }
            
            optionsHtml += `
                <div class="quiz-review-option" style="color: ${optColor};">
                    <span style="margin-right: 8px;">${optIdx + 1}. ${opt}</span> ${iconHtml}
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="quiz-review-header">
                <h4 class="quiz-review-q-title">Question ${idx + 1}: ${q.q}</h4>
                <span class="quiz-review-status ${isCorrect ? 'correct' : 'incorrect'}">
                    ${isCorrect ? 'Correct' : 'Incorrect'}
                </span>
            </div>
            <div class="quiz-review-options">
                ${optionsHtml}
            </div>
        `;
        reviewContainer.appendChild(card);
    });

    const resultIcon = document.getElementById('quiz-result-icon');
    const resultTitle = document.getElementById('quiz-result-title');
    const passSection = document.getElementById('quiz-pass-section');
    const failSection = document.getElementById('quiz-fail-section');
    
    if (scorePercent >= 75) {
        // Passed (At least 75%)
        resultIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i>';
        resultTitle.textContent = "Evaluation Passed!";
        
        // Record this subject as cleared
        const semIndex = currentYear * 2 + currentSem;
        const key = `${semIndex}-${currentQuizSubjectIndex}`;
        clearedQuizzesState[key] = true;
        localStorage.setItem(LS_CLEARED_QUIZZES, JSON.stringify(clearedQuizzesState));
        
        // Recalculate stats on dashboard
        updateDashboardStats();
        
        passSection.style.display = 'block';
        failSection.style.display = 'none';
        
        passSection.innerHTML = `
            <p style="margin-bottom: 24px; font-size: 0.95rem; color: var(--text-secondary);">
                Congratulations! You have demonstrated proficiency in <strong>${currentQuizSubjectName.replace(/^\d+\.\s+/, '')}</strong>.
            </p>
            <div style="display: flex; justify-content: center; gap: 12px;">
                <button class="btn btn-primary" onclick="backToSyllabusFromQuiz()">Back to Syllabus</button>
                <button class="btn btn-secondary" onclick="switchView('dashboard')">Go to Dashboard</button>
            </div>
        `;
    } else {
        // Failed
        resultIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-rose);"></i>';
        resultTitle.textContent = "Evaluation Failed";
        passSection.style.display = 'none';
        failSection.style.display = 'block';
    }
}

function restartActiveQuiz() {
    startQuizFlow();
}

function backToSyllabusFromQuiz() {
    const semIndex = currentYear * 2 + currentSem;
    selectSemester(currentYear, currentSem, cseAcademicData[semIndex].name);
}



// --- Live Visitor Widget Logic ---
const visitorNames = ["Rahul", "Priya", "Amit", "Sneha", "Karthik", "Neha", "Vikram", "Anjali", "Suresh", "Divya", "Rohit", "Kavya", "Arjun"];
const visitorCities = ["Hyderabad", "Bangalore", "Chennai", "Delhi", "Mumbai", "Pune", "Kolkata", "Vizag", "Ahmedabad", "Noida"];
const visitorActions = ["just logged in!", "is taking a quiz...", "just registered!", "is studying hard!"];

function triggerRandomVisitor() {
    const container = document.getElementById('live-visitor-widget');
    if (!container) return;
    
    // Only show if user is logged in and on dashboard
    const dashboardView = document.getElementById('dashboard-view');
    if (!dashboardView || !dashboardView.classList.contains('active')) {
        const nextDelay = Math.floor(Math.random() * 20000) + 10000;
        setTimeout(triggerRandomVisitor, nextDelay);
        return;
    }
    
    const name = visitorNames[Math.floor(Math.random() * visitorNames.length)];
    const city = visitorCities[Math.floor(Math.random() * visitorCities.length)];
    const action = visitorActions[Math.floor(Math.random() * visitorActions.length)];
    
    const toast = document.createElement('div');
    toast.className = 'visitor-toast';
    
    toast.innerHTML = `
        <div class="visitor-icon"><i class="fa-solid fa-globe"></i></div>
        <div>
            <div class="visitor-text"><strong>${name}</strong> from ${city} ${action}</div>
            <div class="visitor-time">Just now</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 5000);
    
    // Schedule next visitor (randomly between 15s and 30s)
    const nextDelay = Math.floor(Math.random() * 15000) + 15000;
    setTimeout(triggerRandomVisitor, nextDelay);
}

// Start visitor simulation
setTimeout(triggerRandomVisitor, 8000);
