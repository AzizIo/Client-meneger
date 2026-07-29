# 🚀 Client Manager

> A modern project and client management platform built with **FastAPI**, **React**, and **TypeScript**.

Client Manager helps companies and freelancers organize projects, collaborate with clients, manage tasks, approve completed work, and keep the entire workflow transparent.

---

# ✨ Why this project?

Managing projects through messengers quickly becomes chaotic:

- ❌ Tasks get lost in chats.
- ❌ Clients don't know the current project status.
- ❌ No centralized place for files and comments.
- ❌ Difficult to track who completed what.
- ❌ No approval workflow before marking work as finished.
- ❌ No project activity history.

Client Manager solves these problems by providing one centralized platform for both **clients** and **executors**.

---

# 🎯 Main Goals

- Organize projects in one place
- Improve communication between clients and executors
- Track project progress
- Manage files and comments
- Approve completed work before closing tasks
- Keep a complete history of project activity

---

# 🖥️ Tech Stack

## Frontend

- ⚛️ React
- 📘 TypeScript
- React Router
- Context API
- Axios
- Tailwind CSS

## Backend

- ⚡ FastAPI
- SQLAlchemy
- SQLite
- JWT Authentication
- Pydantic

---

# 🔐 Authentication

- ✅ Registration
- ✅ Login
- ✅ JWT Authentication
- ✅ Protected Routes
- ✅ User Roles

---

# 👥 User Roles

### 👨‍💼 Client

- Create projects
- Manage project members
- Create stages
- Approve completed tasks
- Reject submitted work
- Leave comments
- Upload files
- View project activity

### 👨‍💻 Executor

- View assigned projects
- Complete assigned tasks
- Upload files
- Leave comments
- Submit tasks for approval

---

# 📂 Project Management

Each project contains:

- Project information
- Members
- Stages
- Tasks
- Comments
- Files
- Notifications
- Activity history

---

# 📋 Task Management

The system supports:

- ✅ Creating tasks
- ✅ Editing tasks
- ✅ Deleting tasks
- ✅ Task statuses
- ✅ Task assignments
- ✅ Due dates
- ✅ Drag & Drop ordering

---

# ✅ Approval Workflow

One of the main features of the platform.

Instead of marking tasks as completed immediately:

```

Executor
↓
Completes task
↓
Submits for approval
↓
Client reviews
↓
Approve ✅
or
Reject ❌
↓
Task updated

```

This makes the workflow much closer to real business processes.

---

# 💬 Comments

Every task supports discussions.

Users can:

- Add comments
- Discuss implementation
- Communicate directly inside the project

---

# 📎 File Management

Users can upload files to tasks.

Examples:

- Images
- Documents
- PDFs
- Project resources

This keeps everything inside one platform.

---

# 🔔 Notifications

The application automatically generates notifications for important events.

Examples:

- Task submitted
- Task approved
- Task rejected
- New comment
- Project updates

---

# 📜 Activity Log

Every important action is recorded.

Examples:

- Project created
- Task completed
- Approval
- Rejection
- Comments
- File uploads

This creates a transparent project history.

---

# 🎨 Frontend Features

- Responsive UI
- Modern interface
- Protected routes
- Toast notifications
- Context API state management
- Modular component architecture
- TypeScript types

---

# ⚙️ Backend Features

- REST API
- JWT authentication
- Role-based authorization
- SQLAlchemy ORM
- File uploads
- Business validation
- Project permissions
- Approval system
- Activity logging

---

# 📁 Project Structure

```

Client-Manager/

├── frontend/
│ ├── Components/
│ ├── Context/
│ ├── Pages/
│ ├── Services/
│ └── Types/
│
├── backend/
│ ├── main.py
│ ├── models.py
│ ├── schemas.py
│ ├── database.py
│ └── ...
