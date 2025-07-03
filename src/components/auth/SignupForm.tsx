// src/components/auth/SignupForm.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ModeToggle } from '@/components/mode-toggle'; // <-- Add this import

export const SignupForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: formData.email, password: formData.password, userType: 'user' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed.');
      }
      alert('Account created successfully! Please log in.');
      navigate('/login');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen relative">
      <div className="absolute top-4 right-4 z-10"> {/* <-- Add this block for the toggle */}
          <ModeToggle />
      </div>
       <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <div className="flex justify-center items-center gap-3 mb-2">
              <img src="/logo.png" alt="NewsLetter AI Logo" className="h-9 w-9" />
              <h1 className="text-3xl font-bold">
                NewsLetter<span className="text-primary">AI</span>
              </h1>
            </div>
            <p className="text-balance text-muted-foreground">
              Create your account to get started.
            </p>
          </div>
           {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="user-name" type="text" placeholder="John Doe" onChange={(e) => handleInputChange('name', e.target.value)} className="pl-10" required disabled={loading}/>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
               <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="user-email" type="email" placeholder="m@example.com" onChange={(e) => handleInputChange('email', e.target.value)} className="pl-10" required disabled={loading}/>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Password</Label>
               <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="user-password" type="password" onChange={(e) => handleInputChange('password', e.target.value)} className="pl-10" required disabled={loading}/>
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="user-confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="user-confirm-password" type="password" onChange={(e) => handleInputChange('confirmPassword', e.target.value)} className="pl-10" required disabled={loading}/>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing Up...</> : <><UserPlus className="w-4 h-4 mr-2" />Sign Up</>}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <a href="/login" className="underline">
              Sign in
            </a>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block bg-gradient-to-br from-purple-600 to-blue-400 dark:from-purple-900 dark:to-blue-800">
        <div className="flex flex-col justify-center items-center h-full text-white text-center p-12">
            <h2 className="text-4xl font-bold mb-4">Join the Future of Content</h2>
            <p className="text-xl">Sign up in seconds and start building your audience with intelligent, automated newsletters.</p>
        </div>
      </div>
    </div>
  );
};