import React, { useState } from 'react';
import DepartmentsTab from './components/DepartmentsTab';
import CategoriesTab from './components/CategoriesTab';
import EmployeesTab from './components/EmployeesTab';
import { Building, Tags, Users } from 'lucide-react';

const OrgSetup = () => {
  const [activeTab, setActiveTab] = useState('departments');

  const tabs = [
    { id: 'departments', name: 'Departments', icon: Building },
    { id: 'categories', name: 'Asset Categories', icon: Tags },
    { id: 'employees', name: 'Employee Directory', icon: Users },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Organization Setup</h1>
      </div>
      
      {/* Premium Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex space-x-2 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'employees' && <EmployeesTab />}
      </div>
    </div>
  );
};

export default OrgSetup;
