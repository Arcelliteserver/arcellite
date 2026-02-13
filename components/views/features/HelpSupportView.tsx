import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Mail, Book, Github, ExternalLink, Send, CheckCircle, ChevronDown, Loader2, AlertCircle } from 'lucide-react';

interface HelpSupportViewProps {
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  } | null;
}

const SUBJECT_OPTIONS = [
  { value: 'file-management', label: 'File Management', description: 'Upload, download, organize, preview files' },
  { value: 'storage-devices', label: 'Storage & External Devices', description: 'USB drives, HDD, SSD, mounting issues' },
  { value: 'ai-assistant', label: 'AI Assistant', description: 'Chat, file actions, database queries' },
  { value: 'database', label: 'Database Management', description: 'PostgreSQL, tables, queries, connections' },
  { value: 'account-security', label: 'Account & Security', description: 'Login, sessions, verification, privacy' },
  { value: 'setup-installation', label: 'Setup & Installation', description: 'First-time setup, configuration, updates' },
  { value: 'performance', label: 'Performance & Speed', description: 'Slow loading, high CPU, memory issues' },
  { value: 'feature-request', label: 'Feature Request', description: 'Suggest new features or improvements' },
  { value: 'bug-report', label: 'Bug Report', description: 'Something broken or not working right' },
  { value: 'other', label: 'Other', description: 'Anything else not listed above' },
];

const HelpSupportView: React.FC<HelpSupportViewProps> = ({ user }) => {
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';
  const userEmail = user?.email || '';

  const [formData, setFormData] = useState({ name: userName, email: userEmail, subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update form when user data loads
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      name: prev.name || userName,
      email: prev.email || userEmail,
    }));
  }, [userName, userEmail]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const token = localStorage.getItem('arcellite_session');
      const res = await fetch('/api/support/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setError(null);
    setFormData({ name: userName, email: userEmail, subject: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectedSubject = SUBJECT_OPTIONS.find(opt => opt.value === formData.subject);

  const quickLinks = [
    {
      title: 'Documentation',
      description: 'Read the full Arcellite documentation',
      icon: Book,
      action: 'external',
      url: 'https://github.com/arcellite/docs'
    },
    {
      title: 'GitHub Issues',
      description: 'Report bugs or request features',
      icon: Github,
      action: 'external',
      url: 'https://github.com/arcellite/arcellite/issues'
    },
    {
      title: 'Email Support',
      description: 'support@arcellite.com',
      icon: Mail,
      action: 'mailto',
      url: 'mailto:support@arcellite.com'
    },
  ];

  return (
    <div className="w-full">
      {/* Header with Divider */}
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Contact Support
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Get help from our support team</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.title}
              href={link.url}
              target={link.action === 'external' ? '_blank' : undefined}
              rel={link.action === 'external' ? 'noopener noreferrer' : undefined}
              className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center group-hover:bg-[#5D5FEF]/20 transition-all flex-shrink-0">
                <Icon className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[14px] font-black text-gray-900 group-hover:text-[#5D5FEF] transition-colors">
                    {link.title}
                  </h3>
                  {link.action === 'external' && (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#5D5FEF] transition-colors flex-shrink-0" />
                  )}
                </div>
                <p className="text-[12px] text-gray-500">{link.description}</p>
              </div>
            </a>
          );
        })}
      </div>

      {/* Contact Form */}
      <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-6 sm:px-8 py-6 bg-[#F5F5F7]/50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#5D5FEF]" />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-gray-900">Send us a message</h2>
              <p className="text-[11px] font-bold text-gray-400">We'll get back to you within 24 hours</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {submitted ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-[13px] text-gray-500 mb-1">Thank you for contacting us. We'll respond shortly.</p>
              <p className="text-[12px] text-gray-400 mb-6">Check your email for an acknowledgment from our AI assistant.</p>
              <button
                onClick={handleReset}
                className="text-[13px] font-bold text-[#5D5FEF] hover:text-[#4D4FCF] transition-colors"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-[13px] text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-[13px] font-bold text-gray-700 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF] transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-[13px] font-bold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF] transition-all"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Custom Subject Dropdown */}
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-2">
                  Subject
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={`w-full px-4 py-3 bg-[#F5F5F7] border rounded-xl text-[14px] font-medium text-left focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF] transition-all flex items-center justify-between ${
                      dropdownOpen ? 'border-[#5D5FEF] ring-2 ring-[#5D5FEF]/20' : 'border-transparent'
                    }`}
                  >
                    {selectedSubject ? (
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-900">{selectedSubject.label}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Select a topic...</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-2xl shadow-gray-200 border border-gray-100 py-2 max-h-[320px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 origin-top">
                      {SUBJECT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, subject: option.value });
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-[#F5F5F7] transition-all flex flex-col gap-0.5 ${
                            formData.subject === option.value ? 'bg-[#5D5FEF]/5' : ''
                          }`}
                        >
                          <span className={`text-[14px] font-bold ${
                            formData.subject === option.value ? 'text-[#5D5FEF]' : 'text-gray-900'
                          }`}>
                            {option.label}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            {option.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Hidden input for form validation */}
                <input
                  type="text"
                  value={formData.subject}
                  required
                  onChange={() => {}}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-[13px] font-bold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 focus:border-[#5D5FEF] transition-all resize-none"
                  placeholder="Describe your issue or question in detail..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending || !formData.subject}
                  className="flex items-center gap-2 px-6 py-3 bg-[#5D5FEF] text-white rounded-xl font-bold text-[13px] hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <h3 className="text-[13px] font-black text-gray-900 mb-2">Response Time</h3>
        <p className="text-[12px] text-gray-600 mb-4">
          We typically respond within 24 hours during business days (Monday-Friday, 9 AM - 6 PM EST).
          For urgent issues, please include "URGENT" in your subject line.
        </p>
        <p className="text-[11px] text-gray-500">
          For security vulnerabilities, please email <a href="mailto:security@arcellite.com" className="text-[#5D5FEF] hover:underline font-bold">security@arcellite.com</a>
        </p>
      </div>
    </div>
  );
};

export default HelpSupportView;
