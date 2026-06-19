import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './Pages/LoginPage'
import MainPage from './Pages/MainPage'
import RegisterPage from './Pages/RegisterPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/main" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App