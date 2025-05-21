
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Card from '@/components/Card';

const NotFound = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md text-center">
          <h1 className="text-6xl font-bold text-kala-blue mb-4">404</h1>
          <h2 className="text-2xl font-medium mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-6">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <Link to="/" className="kala-button inline-block">
            Return to Home
          </Link>
        </Card>
      </div>
    </Layout>
  );
};

export default NotFound;
