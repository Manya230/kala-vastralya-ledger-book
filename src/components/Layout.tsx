import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingCart, FileText } from "lucide-react";
import { Inventory } from "@/components/icons/KalaIcons";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b py-4 px-6 bg-white">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            <Link to="/" className="text-kala-blue">Kalan Vastralya</Link>
          </h1>
          
          <nav className="flex gap-2">
            <Link 
              to="/" 
              className={`flex items-center gap-1 px-3 py-1 rounded ${
                isActive("/") ? "bg-kala-blue text-white" : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Home size={18} />
              <span className="hidden md:inline">Home</span>
            </Link>
            
            <Link 
              to="/new-sale" 
              className={`flex items-center gap-1 px-3 py-1 rounded ${
                isActive("/new-sale") ? "bg-kala-blue text-white" : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <ShoppingCart size={18} />
              <span className="hidden md:inline">New Sale</span>
            </Link>
            
            <Link 
              to="/inventory" 
              className={`flex items-center gap-1 px-3 py-1 rounded ${
                isActive("/inventory") ? "bg-kala-blue text-white" : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Inventory size={18} />
              <span className="hidden md:inline">Inventory</span>
            </Link>
            
            <Link 
              to="/sales-report" 
              className={`flex items-center gap-1 px-3 py-1 rounded ${
                isActive("/sales-report") ? "bg-kala-blue text-white" : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <FileText size={18} />
              <span className="hidden md:inline">Sales Report</span>
            </Link>
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 bg-kala-light-blue">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
