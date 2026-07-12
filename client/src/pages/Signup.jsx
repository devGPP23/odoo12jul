import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Eye, EyeOff, Building2 } from 'lucide-react';

const Signup = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/auth/signup', { name, email, password });
      // Auto-login after successful signup
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80')] bg-cover bg-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      <div className="relative w-full max-w-md p-8 overflow-hidden">
        {/* Glassmorphic Card */}
        <div className="absolute inset-0 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
              <Building2 size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
            <p className="text-blue-100 mt-2 font-medium">Join AssetFlow ERP</p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/90 text-white p-3 text-sm backdrop-blur-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-50 mb-1" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  className="block w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-blue-200/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-50 mb-1" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  className="block w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-blue-200/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-50 mb-1" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="block w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-blue-200/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all pr-12"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-blue-100">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-white hover:text-blue-200 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
