import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Card from '@/components/Card';
import { ShoppingCart, FileText } from 'lucide-react';
import { Inventory } from '@/components/icons/KalaIcons';

const Home = () => {
  return (
    <Layout>
      <div className="text-center mb-8 mt-4">
        <h1 className="text-3xl font-bold text-kala-blue mb-2">Welcome to Kalan Vastralya</h1>
        <p className="text-gray-600">Manage your inventory, create bills, and track sales all in one place.</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <Card className="h-full flex flex-col">
            <div className="flex flex-col items-center pb-6 pt-4">
              <div className="bg-kala-blue rounded-full p-4 mb-4">
                <ShoppingCart size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-kala-blue mb-1">New Sale</h2>
              <p className="text-sm text-gray-500 mb-4">Create a new bill or estimate</p>
              <Link 
                to="/new-sale"
                className="kala-button mt-auto w-full text-center"
              >
                Create Sale
              </Link>
            </div>
          </Card>
          
          <div className="bg-white p-4 rounded-lg mt-4 text-sm">
            <p>Record a new sale, scan barcodes, and generate bills or estimates for your customers.</p>
          </div>
        </div>
        
        <div>
          <Card className="h-full flex flex-col">
            <div className="flex flex-col items-center pb-6 pt-4">
              <div className="bg-kala-blue rounded-full p-4 mb-4">
                <Inventory size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-kala-blue mb-1">Inventory</h2>
              <p className="text-sm text-gray-500 mb-4">Manage your products</p>
              <Link 
                to="/inventory"
                className="kala-button mt-auto w-full text-center"
              >
                View Inventory
              </Link>
            </div>
          </Card>
          
          <div className="bg-white p-4 rounded-lg mt-4 text-sm">
            <p>Add new products, update stock levels, and manage categories and manufacturers.</p>
          </div>
        </div>
        
        <div>
          <Card className="h-full flex flex-col">
            <div className="flex flex-col items-center pb-6 pt-4">
              <div className="bg-kala-blue rounded-full p-4 mb-4">
                <FileText size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-kala-blue mb-1">Sales Report</h2>
              <p className="text-sm text-gray-500 mb-4">Track your sales</p>
              <Link 
                to="/sales-report"
                className="kala-button mt-auto w-full text-center"
              >
                View Reports
              </Link>
            </div>
          </Card>
          
          <div className="bg-white p-4 rounded-lg mt-4 text-sm">
            <p>View daily sales data, filter by date ranges, and see detailed sales information.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
