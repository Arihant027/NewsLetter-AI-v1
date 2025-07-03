import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '../ui/skeleton';

export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
        <div className="w-full h-screen flex items-center justify-center">
            <Skeleton className='h-20 w-20 rounded-full' />
        </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};