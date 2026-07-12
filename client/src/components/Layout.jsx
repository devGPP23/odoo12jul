import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
