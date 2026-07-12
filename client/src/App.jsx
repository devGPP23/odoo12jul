import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-indigo-600 mb-4">AssetFlow ERP</h1>
          <p className="text-lg text-gray-600">Frontend scaffolding successful!</p>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
