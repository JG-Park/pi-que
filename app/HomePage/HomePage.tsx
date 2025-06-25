'use client'

import React from 'react'

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">YouTube Segment Player</h1>
        {/* VideoPlayer Component */}
        <div className="mb-6">
          {/* VideoPlayer will be implemented here */}
        </div>
        
        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Segments & Queue */}
          <div className="lg:col-span-2">
            {/* SegmentManager will be implemented here */}
            {/* QueueManager will be implemented here */}
          </div>
          
          {/* Right Column - Search & Project */}
          <div>
            {/* VideoSearch will be implemented here */}
            {/* ProjectManager will be implemented here */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage 