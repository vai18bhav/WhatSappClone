# ChatFlow — Real-Time Messaging & Calling Platform

**ChatFlow** is a full-featured, production-style real-time messaging and WebRTC voice/video calling web application inspired by modern chat platforms like WhatsApp.

---

## 🚀 Key Features

* **Authentication & Security:**
  * JWT (JSON Web Token) authentication with secure cookie or `Authorization: Bearer` header
  * Strong password hashing using `bcryptjs` (salt rounds: 12)
  * Account recovery & forgot-password flow with cryptographically secure tokens
  * Profile editing (Display Name, About/Bio, Phone, Avatar picture upload)
  * Granular privacy controls (Last Seen, Profile Photo, About visibility: *Everyone / Contacts / Nobody*)
  * Helmet security headers, CORS origin filtering, and Express rate limiting

* **Real-Time Communication:**
  * Powered by **Socket.IO** with low-latency event delivery
  * 1-on-1 direct conversations & multi-user group chats
  * Real-time message delivery ticks (✓ sent, ✓✓ delivered, ✓✓ read)
  * Live typing indicators (`typing_start`, `typing_stop`)
  * Online presence and dynamic last seen status tracking

* **Message Interactions:**
  * Rich text messages and emoji picker
  * Reply-to quoted message references
  * Copy to clipboard, starring important messages
  * Delete options: *Delete for Me* & *Delete for Everyone*
  * Search message history within any conversation

* **Media & Voice Sharing:**
  * Local disk storage architecture (prepared for seamless S3 / Cloudinary swap)
  * Image and video upload with inline player and modal viewer
  * Document transfer (PDFs, docs, spreadsheets, zip archives) with download cards
  * **Voice Messaging:** Browser `MediaRecorder` API recording with real-time timer, preview, and HTML5 audio player

* **WebRTC Voice & Video Calling:**
  * Native peer-to-peer audio and video calls using `RTCPeerConnection`
  * Signaling conducted entirely through Socket.IO (`call_offer`, `call_answer`, `ice_candidate`, `call_reject`, `call_end`)
  * Call UI overlay with remote video, picture-in-picture local video, mute microphone toggle, and timer

* **Groups & Contacts:**
  * Create groups with custom names, descriptions, and avatar photos
  * Admin rights, member promotion/demotion, member removal, and leave group options
  * Contact search directory by username, email, or phone number

* **Custom ChatFlow Design System:**
  * WhatsApp-inspired layout built cleanly with CSS3 flexbox and variables
  * Dynamic Light and Dark themes saved to local preferences
  * Responsive layout adaptable to desktop, tablet, and mobile browsers

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3, Modern JavaScript (ES6+), Socket.IO Client, Web Audio API, WebRTC |
| **Backend** | Node.js, Express.js, Socket.IO, JWT, bcryptjs, Multer |
| **Database** | MySQL 8+ with foreign key cascades, unique constraints, and indexes |
| **Signaling** | Socket.IO WebSockets |
| **Media Engine** | Multer file uploads with strict MIME validation & size restrictions |

---

## 📂 Project Structure

```
chatflow/
├── backend/
│   ├── config/
│   │   ├── constants.js          # App constants (file types, sizes, roles)
│   │   └── db.js                 # MySQL2 promise pool connection
│   ├── controllers/
│   │   ├── authController.js     # Auth, session, password reset
│   │   ├── callController.js     # Call session logging & history
│   │   ├── chatController.js     # Conversations & unread counters
│   │   ├── groupController.js    # Groups & member permissions
│   │   ├── mediaController.js    # Upload processing & gallery
│   │   ├── messageController.js  # Messages CRUD, reply, star, search
│   │   ├── notificationController.js # Notifications list & status
│   │   └── userController.js     # Directory search, profile, privacy
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & req.user injector
│   │   ├── errorHandler.js       # Central error handler
│   │   ├── upload.js             # Multer disk storage and type filters
│   │   └── validate.js           # express-validator request schemas
│   ├── routes/                   # Clean REST route definitions
│   │   ├── auth.js
│   │   ├── calls.js
│   │   ├── chats.js
│   │   ├── groups.js
│   │   ├── media.js
│   │   ├── messages.js
│   │   ├── notifications.js
│   │   └── users.js
│   ├── services/
│   │   ├── authService.js        # Token signing & bcrypt operations
│   │   └── notificationService.js# Notification dispatcher
│   ├── sockets/
│   │   ├── callSocket.js         # WebRTC signaling events
│   │   ├── messageSocket.js      # Message send/read/typing events
│   │   ├── presenceSocket.js     # Status queries & last-seen
│   │   └── socketHandler.js      # Socket.IO connection coordinator
│   ├── uploads/                  # Upload directories (images, videos, audio, documents)
│   └── server.js                 # HTTP & Socket.IO server entry point
│
├── database/
│   └── schema.sql                # Complete MySQL 8 schema (13 tables)
│
├── frontend/
│   ├── css/
│   │   ├── auth.css              # Login and registration styling
│   │   ├── chat.css              # Message area, bubbles, and media
│   │   ├── main.css              # Variables, themes, toasts, base
│   │   ├── modals.css            # Emoji picker, call overlay, dialogs
│   │   └── sidebar.css           # Conversation list and search box
│   ├── js/
│   │   ├── api.js                # Fetch client wrapper
│   │   ├── auth.js               # Session management & route guards
│   │   ├── call.js               # WebRTC peer connection & media tracks
│   │   ├── chat.js               # Main chat orchestrator
│   │   ├── group.js              # Group API actions
│   │   ├── media.js              # Voice recorder (MediaRecorder) & upload
│   │   ├── message.js            # Message bubbles & context actions
│   │   ├── notification.js       # Audio chimes & Desktop notifications
│   │   ├── profile.js            # User profile view/edit
│   │   ├── search.js             # Debounced queries
│   │   ├── settings.js           # Settings page & privacy preferences
│   │   ├── socket.js             # Socket.IO client singleton
│   │   └── ui.js                 # Theme toggling, toasts, avatar helpers
│   ├── chat.html                 # Main chat app interface
│   ├── index.html                # Splash / auto-router
│   ├── login.html                # Login screen
│   ├── profile.html              # Profile edit screen
│   ├── register.html             # User registration screen
│   └── settings.html             # Preferences & security settings
│
├── .env.example                  # Environment configuration template
├── package.json                  # NPM dependencies & scripts
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
* **Node.js**: v16.x or higher
* **MySQL**: v8.0 or higher

### 2. Install Backend Dependencies
From the `chatflow/` directory:
```bash
npm install
```

### 3. Setup MySQL Database
1. Make sure your MySQL service is running.
2. Run the database migration script:
```bash
mysql -u root -p < database/schema.sql
```
*(Or import `database/schema.sql` using MySQL Workbench / phpMyAdmin).*

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your MySQL credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatflow_db
DB_USER=root
DB_PASSWORD=your_actual_mysql_password

JWT_SECRET=generate_a_secure_long_random_key_here
PORT=3000
```

### 5. Start the Server
```bash
# Production mode
npm start

# Development mode (auto-reload with nodemon)
npm run dev
```

Visit **`http://localhost:3000`** in your browser!

---

## 🧪 Testing Multi-User Chat & Calls

To test real-time features locally:
1. Open `http://localhost:3000` in your normal browser window.
2. Register User 1 (e.g. `alice@example.com`).
3. Open an **Incognito / Private Window** (or a second browser like Chrome & Firefox).
4. Register User 2 (e.g. `bob@example.com`).
5. In User 1's window, click the **💬 (New Chat)** icon, search for `bob`, and click to start a conversation.
6. Test typing, sending text, emojis, uploading an image or PDF, and recording a voice note.
7. Click the **📞 (Voice)** or **📹 (Video)** call buttons to test the real-time WebRTC peer connection!

---

## 🔒 Security Best Practices Implemented

* **Password Hashing:** Passwords are never stored in plaintext; salt rounds = 12.
* **Prepared SQL Statements:** Parameterized queries (`mysql2/promise`) prevent SQL injection.
* **Sanitized Outputs:** Passwords, tokens, and sensitive private fields are purged before sending responses.
* **Rate Limiting:** Protects `/api/auth` endpoints against brute-force attacks.
* **MIME Validation:** Strictly checks file signatures and extensions upon upload.
* **XSS Defense:** Contextual HTML character escaping applied before rendering user content.
