'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiSpecKeys } from '@/hooks/use-api-specs';
import { collectionKeys } from '@/hooks/use-collections';
import { environmentKeys } from '@/hooks/use-environments';
import { projectKeys } from '@/hooks/use-projects';
import { requestKeys } from '@/hooks/use-requests';
import { testCaseKeys } from '@/hooks/use-test-cases';
import { useT } from '@/i18n/client';
import { apiSpecService } from '@/services/api-spec';
import { collectionService } from '@/services/collection';
import { environmentService } from '@/services/environment';
import { projectService } from '@/services/project';
import { requestService } from '@/services/request';
import { testCaseService } from '@/services/test-case';
import type { ApiProject } from '@/types/project';

interface DemoProjectResult {
  project: ApiProject;
}

const timestampSuffix = () => new Date().toISOString().slice(11, 19).replace(/:/g, '');

export function useCreateDemoProject() {
  const queryClient = useQueryClient();
  const t = useT('project');

  return useMutation<DemoProjectResult>({
    mutationFn: async () => {
      const suffix = timestampSuffix();
      const project = await projectService.create({
        name: `示例项目：电商 API ${suffix}`,
        slug: `demo-ecommerce-api-${suffix.toLowerCase()}`,
        platform: 'javascript',
      });

      const projectId = project.id;

      const environment = await environmentService.create(projectId, {
        name: 'demo',
        display_name: 'Demo Store API',
        base_url: 'https://dummyjson.com',
        variables: {
          productId: '1',
          cartUserId: '1',
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      await apiSpecService.create(projectId, {
        method: 'GET',
        path: '/products',
        summary: '商品列表',
        description: '获取商品列表，可作为首页商品瀑布流和搜索结果的基础接口。',
        version: '2026-demo',
        tags: ['demo', 'catalog', 'products'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: '返回的商品数量',
            required: false,
            schema: { type: 'integer', example: 12 },
          },
        ],
        responses: {
          '200': {
            description: '商品列表返回成功',
            content_type: 'application/json',
            schema: {
              type: 'object',
              properties: {
                products: { type: 'array' },
                total: { type: 'integer' },
                skip: { type: 'integer' },
                limit: { type: 'integer' },
              },
            },
          },
        },
      });

      const getProductSpec = await apiSpecService.create(projectId, {
        method: 'GET',
        path: '/products/{id}',
        summary: '商品详情',
        description: '读取单个商品详情，适合详情页和快速验收商品字段。',
        version: '2026-demo',
        tags: ['demo', 'catalog', 'product-detail'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            description: '商品 ID',
            required: true,
            schema: { type: 'integer', example: 1 },
          },
        ],
        responses: {
          '200': {
            description: '商品详情返回成功',
            content_type: 'application/json',
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                price: { type: 'number' },
                stock: { type: 'integer' },
              },
            },
          },
        },
      });

      const addCartSpec = await apiSpecService.create(projectId, {
        method: 'POST',
        path: '/carts/add',
        summary: '加入购物车',
        description: '模拟用户向购物车添加商品，用于体验请求体、示例和测试用例生成。',
        version: '2026-demo',
        tags: ['demo', 'cart', 'checkout'],
        request_body: {
          required: true,
          content_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              userId: { type: 'integer', example: 1 },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer', example: 1 },
                    quantity: { type: 'integer', example: 1 },
                  },
                },
              },
            },
            required: ['userId', 'products'],
          },
        },
        responses: {
          '200': {
            description: '购物车更新成功',
            content_type: 'application/json',
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                total: { type: 'number' },
                discountedTotal: { type: 'number' },
                totalProducts: { type: 'integer' },
              },
            },
          },
        },
      });

      await apiSpecService.createExample(projectId, getProductSpec.id, {
        name: '商品详情成功',
        response_status: 200,
        duration_ms: 180,
        response_body: {
          id: 1,
          title: 'Essence Mascara Lash Princess',
          price: 9.99,
          stock: 99,
        },
      });

      // Request endpoints can only live under non-folder collections.
      const requestCollection = await collectionService.create(projectId, {
        name: 'Demo Requests',
        description: '开箱即用的电商 API 请求集合',
        is_folder: false,
        sort_order: 1,
      });

      await requestService.create(projectId, requestCollection.id, {
        name: 'List products',
        method: 'GET',
        url: '{{base_url}}/products?limit=3',
        description: '快速查看商品列表是否返回成功',
        headers: [
          { key: 'Accept', value: 'application/json', enabled: true },
        ],
        query_params: [],
        path_params: {},
        body: '',
        body_type: 'none',
        sort_order: 1,
      });

      await requestService.create(projectId, requestCollection.id, {
        name: 'Add item to cart',
        method: 'POST',
        url: '{{base_url}}/carts/add',
        description: '模拟加入购物车请求，展示 JSON 请求体与响应',
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true },
        ],
        query_params: [],
        path_params: {},
        body: '{"userId":{{cartUserId}},"products":[{"id":{{productId}},"quantity":1}]}',
        body_type: 'json',
        sort_order: 2,
      });

      await testCaseService.fromSpec(projectId, {
        api_spec_id: addCartSpec.id,
        name: '加入购物车烟雾测试',
        env: environment.name,
      });

      return { project };
    },
    onSuccess: ({ project }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(project.id) });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: environmentKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: requestKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: testCaseKeys.project(project.id) });
      toast.success(t('toasts.projectCreated', { name: project.name }));
    },
    onError: () => {
      toast.error(t('dashboardPage.demoProjectCreateFailed'));
    },
  });
}
