# 🎬 Watch Party App
A real-time Watch Party web application where users can watch YouTube videos together, chat, and control playback based on roles (Host / Moderator / Participant).
______________________________________________________________________________________________________________________________________________
**Live Deployment:-**
Frontend (Vercel): https://watchparty-green.vercel.app
Backend (Render): https://watchparty-backend-2w8d.onrender.com
_______________________________________________________________________________________________________________________________________________
**Features:-**
🎥 Watch YouTube videos in sync
👥 Multi-user room system
🧑‍💼 Role-based control:
Host (full control)
Moderator (limited control)
Participant (view only)
Real-time chat
Live sync (play, pause, seek, change video)
Remove users from room
_________________________________________________________________________________________________________________________________________________
**Tech Stack**
Frontend:
* React (Vite)
* Socket.io Client
Backend:
* Node.js
* Express.js
* Socket.io
Database:
MongoDB (Mongoose)
Deployment:
* Vercel (Frontend)
* Render (Backend)
_______________________________________________________________________________________________________________________________________________
**Project Structure**
watchparty/
│
├── frontend/        # React App
├── backend/         # Node + Socket.io Server
└── README.md
_______________________________________________________________________________________________________________________________________________
**Setup & Run Locally**

**1.Clone the repository**

```bash
git clone https://github.com/richakaushik461/watchparty.git
cd watchparty
```
________________________________________________________________________________________________________________________________________________
**2.Setup Backend**

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```
MONGO_URI=your_mongodb_connection_string
```

Run backend:

```bash
npm start
```
_______________________________________________________________________________________________________________________________________________
**3.Setup Frontend**
```bash
cd ../frontend
npm install
npm run dev
___________________________________________________________________________________________________________________________________________________
**4.Open in Browser**
```
http://localhost:5173
```
___________________________________________________________________________________________________________________________________________________
**How It Works**

1. User enters **username + room ID**
2. First user becomes **Host**
3. Others join as **Participants**
4. Host controls:

   * Play / Pause
   * Change video
   * Assign roles
5. All users stay **perfectly synced**
_____________________________________________________________________________________________________________________________________________________
**Future Improvements**

* Authentication (Login/Signup)
* Video queue system
* Voice chat
* Private rooms with passwords
* Mobile responsiveness improvements
_______________________________________________________________________________________________________________________________________________
**Author**
Richa Kaushik
____________________________________________________________________________________________________________________________________________________
**Note**
This project demonstrates real-time synchronization using Socket.io and handling of YouTube Iframe API with React.
_____________________________________________________________________________________________________________________________________________________
