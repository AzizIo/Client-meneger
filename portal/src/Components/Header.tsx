import SaidBar from './SideBar'
import { Bell, UsersRound } from 'lucide-react';
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../API/api';
export default function Header() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get('/auth/me')
        setMe(res.data)
      } catch (error) {
        console.error('Error fetching profile:', error)
      }

    }
    fetchProfile()
  }, [])

  return (

    <>
      <header className='p-4' >
        <div className='flex  justify-between ' >

          <div className='flex gap-4 items-center  ' >

            <SaidBar />
            <div>Dashboard</div>
          </div>

          <div className='flex  gap-8 items-center  ' >
            <Bell size={18} />
            <div onClick={() => navigate('/profile')} >
              {me?.avatar_url ? <div className="" >
                <img className="flex h-8 w-8  hover:bg-black/50 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white" src={me.avatar_url} alt="" />
              </div> : <div>
                <div className="flex   hover:bg-zinc-400 h-20 w-20 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white">

                  <img src={me?.avatar_url} alt="" />
                  <span className="text-xl font-bold text-indigo-700">{me?.full_name[0].toUpperCase()}</span>
                </div>

              </div>}
            </div>
          </div>
        </div>
      </header>
      <hr className='w-full mb-2 border-gray-200' />
    </>
  )
}