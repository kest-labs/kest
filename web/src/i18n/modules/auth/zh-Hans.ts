// Auth translations - Simplified Chinese
const messages = {
  // Page titles
  welcomeBack: '登录 kest web',
  signInToContinue: '继续访问工作区、流程运行记录与 AI 诊断视图',
  createAccount: '创建账户',
  getStarted: '开始使用平台',
  resetPasswordDescription: '输入注册邮箱，后端会触发密码重置流程。',
  registrationDisabled: '注册已关闭',
  registrationDisabledMessage: '该平台目前暂不开放注册，请联系管理员获取访问权限。',
  backToSignIn: '返回登录',
  
  // Form labels
  username: '用户名',
  usernameOrEmail: '用户名或邮箱',
  email: '邮箱',
  nickname: '昵称',
  phone: '手机号',
  password: '密码',
  currentPassword: '当前密码',
  newPassword: '新密码',
  confirmPassword: '确认密码',
  fullName: '姓名',
  
  // Form placeholders
  enterUsername: '请输入用户名',
  enterUsernameOrEmail: '请输入用户名或邮箱',
  enterEmail: '请输入邮箱地址',
  enterNickname: '请输入昵称（可选）',
  enterPhone: '请输入手机号（可选）',
  enterPassword: '请输入密码',
  createPassword: '创建一个强密码',
  confirmYourPassword: '请再次输入密码',
  enterFullName: '请输入您的姓名',
  
  // Actions
  login: '进入 kest web',
  logout: '退出登录',
  register: '注册',
  signIn: '登录',
  signUp: '注册',
  forgotPassword: '忘记密码？',
  resetPassword: '重置密码',
  sendResetLink: '发送重置邮件',
  
  // Links
  noAccount: '没有账号？',
  hasAccount: '已有账号？',
  rememberMe: '记住我',
  
  // Terms
  agreeToTerms: '我同意',
  termsOfService: '服务条款',
  and: '和',
  privacyPolicy: '隐私政策',
  orContinueWith: '或通过以下方式继续',
  
  // Password requirements
  passwordRequirements: '密码要求',
  passwordReqLength: '至少8个字符',
  passwordReqCase: '包含大小写字母',
  passwordReqNumber: '包含至少一个数字',
  passwordReqSpecial: '包含至少一个特殊字符',
  
  // Decorative panel
  brandName: 'kest web',
  heroEyebrow: '面向现代 API 团队',
  heroTitle: '在一个工作区里管理你的 API 测试流',
  heroSubtitle: '串联请求、复用上下文、回看历史结果，并在失败时获得 AI 辅助诊断。',
  feature1: '可视化测试流',
  feature2: '自动透传上下文',
  feature3: '历史运行与回归追踪',
  feature4: 'AI 辅助失败诊断',
  trustNote: '开源核心，服务于注重工程效率的 API 团队',
  loginBadge: 'kest workspace access',
  insight1Title: '流程工作区',
  insight1Description: '按工作区组织请求链路、环境配置与共享上下文。',
  insight2Title: '执行历史',
  insight2Description: '快速定位回归、耗时波动与状态变化。',
  insight3Title: 'AI 诊断',
  insight3Description: '结合上下文解释失败原因，并给出修复方向。',
  
  // Validation messages
  nameRequired: '请输入姓名',
  nameMinLength: '姓名至少需要2个字符',
  nameTooLong: '姓名过长',
  emailRequired: '请输入邮箱',
  emailInvalid: '请输入有效的邮箱地址',
  passwordRequired: '请输入密码',
  passwordMinLength: '密码至少需要8个字符',
  passwordTooLong: '密码过长',
  passwordTooShort: '密码过短',
  passwordInvalid: '密码必须包含大小写字母、数字和特殊字符',
  confirmPasswordRequired: '请确认密码',
  passwordsDoNotMatch: '两次输入的密码不一致',
  termsRequired: '请同意服务条款和隐私政策',
  
  // Toast messages
  loginSuccess: '登录成功',
  loginFailed: '登录失败',
  welcomeBackUser: '欢迎回来，{name}',
  logoutSuccess: '退出成功',
  logoutFailed: '退出失败',
  registerSuccess: '注册成功',
  registerFailed: '注册失败',
  accountCreated: '账号创建成功，正在登录...',
  invalidCredentials: '邮箱或密码错误',
  
  // Social login
  signInWithGoogle: '使用 Google 登录',
  signInWithApple: '使用 Apple 登录',
  signInWithGithub: '使用 GitHub 登录',
  signUpWithGoogle: '使用 Google 注册',
  signUpWithApple: '使用 Apple 注册',
  signUpWithGithub: '使用 GitHub 注册',
  
  // Footer
  allRightsReserved: '版权所有',
};

export default messages;

export type AuthMessages = typeof messages;
