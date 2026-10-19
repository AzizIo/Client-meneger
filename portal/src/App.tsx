import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './Pages/LoginPage'
import MainPage from './Pages/MainPage'
import RegisterPage from './Pages/RegisterPage'
import ProfilePage from './Pages/ProfilePage'
import NewProjectPage from './Pages/NewProjectPage'
import ProjectDetait from './Pages/ProjectDetait'
import ProjectsPage from './Pages/ProjectsPage'
import NotificationsPage from './Pages/NotificationsPage'
import SetiingPage from './Pages/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/new-project" element={<NewProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetait />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SetiingPage />} />
      </Routes>

    </BrowserRouter>
  )
}

export default App