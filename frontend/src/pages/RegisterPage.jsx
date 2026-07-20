import { useForm } from 'react-hook-form'
import { decodeToken, authRegister } from '../services/apiAuth'
import Swal from 'sweetalert2'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import logo from '../assets/logo.png'
import Navbar from '../components/layout/Navbar'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [roleOptions, setRoleOptions] = useState([])
  const [plantOptions, setPlantOptions] = useState([])  

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm()

  useEffect(() => {
    const token_detail = decodeToken()
    if (token_detail.role.toLowerCase() === 'admin') {
      setRoleOptions(['Admin', 'Engineer', 'User'])
    } else if (token_detail.role.toLowerCase() === 'engineer') {
      setRoleOptions(['Engineer', 'User'])
    }
  }, [])

  async function onSubmit(data) {
    try {
      // console.log('Register data:', data)
      // await authRegister(data)  <-- call your register API here
      const token_detail = decodeToken()
      
      await authRegister({
        en: data.en.trim(),
        password: data.password.trim(),
        role: data.role.toLowerCase().trim(),
        plant: token_detail.role === 'admin' ? data.plant :   token_detail.plant
      })  // ✅ Call the API to register the user

      await Swal.fire({
        icon: 'success',
        title: 'สร้างบัญชีสำเร็จ',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true,
      })
      reset()
      navigate('/')
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
      })
    }
  } // ✅ onSubmit closes here

  return (  // ✅ return is now at the component level
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">

        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Logo" className="h-20 w-auto mb-4" />
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Create a new account
          </h2>
        </div>

        {/* Form */}
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>

          {/* Employee Number */}
          <div>
            <label htmlFor="en" className="block text-sm font-medium text-gray-800 mb-1">
              Employee Number
            </label>
            <input
              {...register('en', {
                required: 'กรุณากรอกเลขพนักงาน',
                pattern: {
                  value: /^([0-9]{6})$/,
                  message: 'รูปแบบเลขพนักงานไม่ถูกต้อง',
                },
              })}
              id="en"
              type="text"
              placeholder="Input your EN number without 41"
              className={`block w-full rounded-md px-3 py-2 text-sm text-gray-900 border placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                ${errors.en ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
            />
            {errors.en && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.en.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1">
              Password
            </label>
            <input
              {...register('password', {
                required: 'กรุณากรอกรหัสผ่าน',
                minLength: {
                  value: 4,
                  message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร',
                },
              })}
              type="password"
              id="password"
              placeholder="Input your password"
              className={`block w-full rounded-md px-3 py-2 text-sm text-gray-900 border placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-800 mb-1">
              Role
            </label>
            <select
              {...register('role', { required: 'กรุณาเลือกบทบาท' })}
              id="role"
              className={`block w-full rounded-md px-3 py-2 text-sm text-gray-900 border placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                ${errors.role ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
            >
              <option value="">Select a role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {errors.role && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.role.message}
              </p>
            )}
          </div>

          {/* Plant */}
          <div>
            <label htmlFor="plant" className="block text-sm font-medium text-gray-800 mb-1">
              Plant
            </label>
            <input
              {...register('plant', {
                required: 'กรุณากรอกชื่อโรงงาน',
              })}
              type="text"
              id="plant"
              placeholder="Input your plant name"
              className={`block w-full rounded-md px-3 py-2 text-sm text-gray-900 border placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition
                ${errors.plant ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
            />
            {errors.plant && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.plant.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing Up...
              </>
            ) : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  )
}