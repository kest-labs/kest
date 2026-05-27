// Auth translations - English (US)
import type { AuthMessages } from './zh-Hans';

const messages: AuthMessages = {
  // Page titles
  welcomeBack: 'Sign in to kest web',
  signInToContinue: 'Continue to your workspaces, flow runs, and AI diagnosis.',
  createAccount: 'Create account',
  getStarted: 'Get started with the platform',
  resetPasswordDescription: 'Enter the email address registered to your account and the backend will trigger the password reset flow.',
  registrationDisabled: 'Registration Disabled',
  registrationDisabledMessage: 'Registration is currently disabled for this platform. Please contact your administrator for access.',
  backToSignIn: 'Back to sign in',
  
  // Form labels
  username: 'Username',
  usernameOrEmail: 'Username or Email',
  email: 'Email',
  nickname: 'Nickname',
  phone: 'Phone',
  password: 'Password',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  confirmPassword: 'Confirm Password',
  fullName: 'Full Name',
  
  // Form placeholders
  enterUsername: 'Enter your username',
  enterUsernameOrEmail: 'Enter your username or email',
  enterEmail: 'Enter your email',
  enterNickname: 'Enter a nickname (optional)',
  enterPhone: 'Enter a phone number (optional)',
  enterPassword: 'Enter your password',
  createPassword: 'Create a strong password',
  confirmYourPassword: 'Confirm your password',
  enterFullName: 'Enter your full name',
  
  // Actions
  login: 'Enter kest web',
  logout: 'Sign Out',
  register: 'Sign Up',
  signIn: 'Sign In',
  signUp: 'Sign Up',
  forgotPassword: 'Forgot password?',
  resetPassword: 'Reset Password',
  sendResetLink: 'Send Reset Email',
  
  // Links
  noAccount: "Don't have an account?",
  hasAccount: 'Already have an account?',
  rememberMe: 'Remember me',
  
  // Terms
  agreeToTerms: 'I agree to the',
  termsOfService: 'Terms of Service',
  and: 'and',
  privacyPolicy: 'Privacy Policy',
  orContinueWith: 'Or continue with',
  
  // Password requirements
  passwordRequirements: 'Password requirements',
  passwordReqLength: 'At least 8 characters long',
  passwordReqCase: 'Contains uppercase and lowercase letters',
  passwordReqNumber: 'Contains at least one number',
  passwordReqSpecial: 'Contains at least one special character',
  
  // Decorative panel
  brandName: 'kest web',
  heroEyebrow: 'Built for modern API teams',
  heroTitle: 'Operate every API workflow from one workspace',
  heroSubtitle: 'Chain requests, reuse context, inspect historical runs, and get AI-assisted diagnosis when something breaks.',
  feature1: 'Visual test flows',
  feature2: 'Context-aware request chaining',
  feature3: 'Run history and regression tracing',
  feature4: 'AI-assisted failure diagnosis',
  trustNote: 'Open-source at the core, built for execution-heavy API teams.',
  loginBadge: 'kest workspace access',
  insight1Title: 'Flow workspaces',
  insight1Description: 'Group request chains, environments, and shared context by workspace.',
  insight2Title: 'Execution history',
  insight2Description: 'Spot regressions, latency shifts, and state changes without replaying the chain.',
  insight3Title: 'AI diagnosis',
  insight3Description: 'Explain failures with context and point the team toward the likely fix.',
  
  // Validation messages
  nameRequired: 'Name is required',
  nameMinLength: 'Name must be at least 2 characters',
  nameTooLong: 'Name is too long',
  emailRequired: 'Email is required',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  passwordMinLength: 'Password must be at least 8 characters',
  passwordTooLong: 'Password is too long',
  passwordTooShort: 'Password is too short',
  passwordInvalid: 'Password must contain uppercase, lowercase, number and special character',
  confirmPasswordRequired: 'Please confirm your password',
  passwordsDoNotMatch: 'Passwords do not match',
  termsRequired: 'You must accept the terms and conditions',
  
  // Toast messages
  loginSuccess: 'Login successful',
  loginFailed: 'Login failed',
  welcomeBackUser: 'Welcome back, {name}',
  logoutSuccess: 'Logout successful',
  logoutFailed: 'Logout failed',
  registerSuccess: 'Registration successful',
  registerFailed: 'Registration failed',
  accountCreated: 'Account created, signing in...',
  invalidCredentials: 'Invalid email or password',
  
  // Social login
  signInWithGoogle: 'Sign in with Google',
  signInWithApple: 'Sign in with Apple',
  signInWithGithub: 'Sign in with GitHub',
  signUpWithGoogle: 'Sign up with Google',
  signUpWithApple: 'Sign up with Apple',
  signUpWithGithub: 'Sign up with GitHub',
  
  // Footer
  allRightsReserved: 'All rights reserved',
};

export default messages;
