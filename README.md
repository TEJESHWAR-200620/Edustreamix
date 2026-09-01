# Edu Streamix Tech 🎓

[![Version](https://img.shields.io/badge/version-5.0.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D14.x-green)]()

> **Edu Streamix Tech** is a comprehensive **CSE Study Portal** designed for **Osmania University B.Tech CSE (R22)** students. It provides an interactive platform to track syllabus progress, watch embedded YouTube video lectures, take subject-wise quizzes, bookmark important topics, and manage personal study notes — all in one place.

🔗 **Live Demo:** [https://edu-orcin-nine.vercel.app/](https://edustreamix.vercel.app/)

---

## ✨ Features

### 🎯 Core Academic Features
- **Complete R22 B.Tech CSE Syllabus** — 4 years, 8 semesters, 47+ subjects covering all core and elective courses
- **Embedded Video Lectures** — YouTube videos embedded directly within each unit/topic
- **Smart Search** — Search across subjects, units, and chapters with relevance scoring
- **Interactive Quizzes** — Auto-generated dynamic quizzes per chapter with 5 questions each; pass at 75%+ to clear a subject
- **Progress Tracking** — Track completed chapters with visual progress bars per semester and overall
- **Bookmarks** — Save important units for quick review
- **Personal Study Notes** — Write and save notes for any topic
- **Workshop Section** — Dedicated access to Engineering Workshop content

### 🔐 Authentication & Accounts
- **Google Sign-In** — Real Google OAuth 2.0 authentication via Google Identity Services
- **Email/Password Registration** — With strict password strength validation (8+ chars, uppercase, number, symbol)
- **Demo Account** — Pre-issued `demopro` credentials after subscription purchase for full-access trial
- **Session Persistence** — Login state and progress persist via localStorage

### 💰 Subscription & Payments
- **Razorpay Integration** — One-time ₹49 subscription for full access to quizzes and premium features
- **Free Tier** — Browse syllabus and watch videos without subscription; quizzes are gated behind subscription

### 🛠️ Productivity Tools
- **Pomodoro Timer** — Built-in focus timer with work (25m), short break (5m), and long break (15m) modes with audio alerts
- **Quick Resume** — Recently accessed topics for seamless study continuation
- **Semester Progress Dashboard** — Visual progress bars for each semester with percentage completion

### 🎨 UI/UX
- **Dark & Light Themes** — Toggle between premium dark mode and clean light mode, persisted across sessions
- **Glassmorphism Design** — Modern blur effects, animated gradients, and floating glow orbs
- **Fully Responsive** — Works on desktop, tablet, and mobile with collapsible sidebar
- **Animated Transitions** — Smooth page transitions, hover effects, and staggered animations
- **Live Visitor Widget** — Simulated live activity feed on the dashboard

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Edustreamix

# Install dependencies (none required — this is a static site with a simple server)
# But if you want the dev server:
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5500`.

### Running Without the Server
Simply open `index.html` in your browser — the app works as a fully static site with no build step required.

---

## 🏗️ Project Structure

```
Edustreamix/
├── index.html              # Main HTML file with all page views and UI components
├── style.css               # Complete stylesheet with dark/light themes, animations, responsive design
├── app.js                  # Frontend application logic (auth, navigation, quizzes, notes, pomodoro, etc.)
├── data.js                 # Academic syllabus data (8 semesters) + quiz question bank
├── server.js               # Node.js HTTP server for local development
├── package.json            # Project metadata and scripts
├── settings.json           # VS Code Live Server settings
├── test.js                 # Utility tests for YouTube URL extraction
├── README.md               # This file
├── osmania_logo_black.png  # Osmania University logo
├── otbi_logo_black.png     # OTBI logo
└── tchetty_logo.png        # Tchetty logo
```

---

## 📖 Usage Guide

### First-Time Setup
1. Open the app in your browser
2. You'll be greeted with a beautiful split-layout login screen
3. **Register** a new account or **Sign in** with Google
4. Your account is automatically created in the browser's localStorage

### Navigating the Syllabus
- Click on **1st Year**, **2nd Year**, **3rd Year**, or **4th Year** in the sidebar to expand semesters
- Click on any semester to view all subjects
- Click **Explore** on a subject card to see its chapters/units
- Click **Watch** to play the embedded YouTube video for a topic
- Click the checkbox next to each topic to mark it as complete

### Taking Quizzes
- Click **Take Quiz** on any subject card
- Answer 5 multiple-choice questions generated dynamically based on the chapter content
- Score **75% or higher** to pass the subject evaluation
- Passed subjects are recorded in your progress stats

### Using the Pomodoro Timer
- Found on the **Dashboard** in the right panel
- Choose **Focus** (25 min), **Short Break** (5 min), or **Long Break** (15 min)
- Click **Start** to begin; the timer plays an alert sound when complete
- Automatically switches between work and break modes

### Managing Bookmarks & Notes
- Click the **Bookmark** icon (📌) on any topic to save it
- View all bookmarks via the **Bookmarks** sidebar item
- Click **Notes** (✏️) on any topic to open a text editor — notes are saved locally

### Searching
- Use the **search bar** in the top navigation to find any subject, chapter, or topic
- Results are ranked by relevance score

### Subscription
- Click the **Go Premium** / **Premium** button in the top bar
- Subscribe for ₹49 via Razorpay to unlock all quizzes
- Demo account credentials are provided after purchase

### Resetting Progress
- Click **Reset Progress** in the sidebar footer to clear all progress, bookmarks, notes, and study history

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| **HTML5** | Semantic page structure with all UI views |
| **CSS3** | Styling with CSS variables, animations, flexbox, grid, glassmorphism |
| **Vanilla JavaScript** | All application logic — no frameworks needed |
| **Node.js `http`** | Lightweight dev server |
| **Google Identity Services** | Real Google OAuth 2.0 sign-in |
| **Razorpay Checkout SDK** | Secure payment processing for subscriptions |
| **Font Awesome 6** | Icon library |
| **Google Fonts** | Plus Jakarta Sans, Outfit, Playfair Display, Great Vibes |
| **YouTube** | Embedded video lectures for all topics |

---

## 📊 Syllabus Coverage

### I Year
- **Semester I:** Matrices & Calculus, Engineering Chemistry, Programming (C), Basic Electrical Engineering, Engineering Graphics, Elements of CS&E
- **Semester II:** ODE & Vector Calculus, Applied Physics, Engineering Workshop, English for Skill Enhancement, Electronic Devices & Circuits, Environmental Science

### II Year
- **Semester III:** Discrete Mathematics, Data Structures, OOP through Java, Computer Organization & Architecture, Software Engineering, MFCS
- **Semester IV:** DBMS, Operating Systems, DAA, Computer Networks, FLAT, Probability & Statistics

### III Year
- **Semester V:** Compiler Design, Computer Graphics, Web Technologies, Machine Learning, Embedded Systems, NLP (Professional Elective)
- **Semester VI:** Artificial Intelligence, Data Warehousing & Data Mining, Software Testing, IoT, Distributed Databases, Entrepreneurship & Management

### IV Year
- **Semester VII:** Cryptography & Network Security, Cloud Computing, Cyber Security, Graph Theory (PE), DevOps (PE), Software Project Management
- **Semester VIII:** Big Data Analytics, Blockchain Technology, Deep Learning (PE), Mobile Application Development, Professional Ethics & Human Values

---

## 🔧 Configuration

### Environment Variables
No `.env` file required. Key configuration is in `app.js`:

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for sign-in | *Set in app.js* |
| `RAZORPAY_KEY_ID` | Razorpay API key for payments | *Set in app.js* |
| `SUBSCRIPTION_AMOUNT` | Subscription price in paise (₹49) | `4900` |
| `PORT` | Server port | `5500` |

### VS Code Settings
The project includes `.vscode/settings.json` with Live Server configured on port **5501**.

---

## 📁 Key Data Structures

### Academic Data (`data.js`)
```javascript
const cseAcademicData = [
  {
    name: "I YEAR – I SEMESTER (R22 CSE)",
    subjects: [
      {
        name: "1. Matrices and Calculus",
        units: [
          { unit: "Unit 1", chapter: "Matrices", link: "https://youtube.com/..." },
          // ... 5 units per subject
        ]
      }
      // ... 6 subjects per semester
    ]
  }
  // ... 8 semesters total
];
```

### Quiz Data (`data.js`)
Pre-built quiz question bank (`cseQuizzesData`) with 5-question sets for key chapters. Chapters without pre-built questions get dynamically generated quizzes using domain concepts, terms, and objectives.

---

## 🎨 Design Highlights

- **Color Palette:** Deep dark backgrounds (`#0a0a0f`) with vibrant multi-color accents (indigo, cyan, emerald, rose, amber, purple)
- **Glassmorphism:** Backdrop blur effects on cards, panels, and modals
- **Animated Backgrounds:** Floating gradient orbs, subtle glow animations
- **Typography:** Outfit for headings, Plus Jakarta Sans for body text
- **Gradients:** Accent gradients for branding, buttons, and visual elements
- **Micro-animations:** Hover transforms, checkbox transitions, toast notifications, staggered entry animations

---

## 📸 Screenshots

### Login Page
The professional split-layout login features a branded left panel with a testimonial, Google sign-in, and registration form with real-time password strength meter.

### Dashboard
Stats grid showing total subjects, completed chapters, overall progress percentage, and bookmark count. Semester progress bars, Pomodoro timer, and quick resume panel.

### Courseware
Subject cards with progress indicators. Chapter list with embedded YouTube videos, checkboxes, bookmarks, notes, and watch buttons.

### Quiz
Question-by-question interface with progress bar, 75% pass threshold indicator, and detailed results with answer review.

---

## 🤝 Credits & Partners

- **Osmania University** — B.Tech CSE R22 Syllabus
- **OTBI** — Supporting Partner
- **Tchetty** — Supporting Partner
- YouTube — Video lecture resources

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with ❤️ for B.Tech CSE students
- All video content belongs to their respective YouTube creators
- Quiz questions are dynamically generated based on subject domain knowledge
- Icons by [Font Awesome](https://fontawesome.com/)
- Fonts by [Google Fonts](https://fonts.google.com/)
- Payments powered by [Razorpay](https://razorpay.com/)

---

> **Edu Streamix Tech** — *Unlock Your Academic Potential.* 🚀
