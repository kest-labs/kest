// 服务层统一导出入口。
// 作用：让页面或 hooks 从单一模块引入业务 service，减少相对路径扩散。
export { exampleService } from './example';
export type { ExampleService } from './example';
export { authService, userService } from './auth';
export type { AuthService, UserService } from './auth';
export { projectService } from './project';
export type { ProjectService } from './project';
export { apiSpecService } from './api-spec';
export type { ApiSpecService } from './api-spec';
export { categoryService } from './category';
export type { CategoryService } from './category';
export { collectionService } from './collection';
export type { CollectionService } from './collection';
export { environmentService } from './environment';
export type { EnvironmentService } from './environment';
export { memberService } from './member';
export type { MemberService } from './member';
export { historyService } from './history';
export type { HistoryService } from './history';
export { testCaseService } from './test-case';
export type { TestCaseService } from './test-case';
