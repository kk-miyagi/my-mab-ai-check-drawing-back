import { http } from './http';
import { ENDPOINTS } from './endpoints';
import type { StatusListRequest, StatusListResponse } from '../types/statusList';

export const statusListApi = {
  async getStatusList(payload: StatusListRequest): Promise<StatusListResponse> {
    const { data } = await http.post<StatusListResponse>(ENDPOINTS.statusList, payload);
    return data;
  },

  async getStatusListMock(payload: StatusListRequest): Promise<StatusListResponse> {
    if (payload.epic === "create-label") {
      type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

      interface ProcessItem {
        title: string;
        modelName: string;
        fileName: string;
        createdAt: string;
        status: ProcessStatus;
        isComplete: boolean;
      }

      const MOCK_DATA: ProcessItem[] = [
        {title: '部品Aの図面', modelName: 'FC-901SN', fileName: 'TKE-000004', createdAt: '2026-04-01 09:00', status: 'doing', isComplete: false},
        {title: '部品Aの図面', modelName: 'FC-901SN', fileName: 'TKE-000003', createdAt: '2026-04-01 09:00', status: 'doing', isComplete: false},
        {title: '部品Bの図面', modelName: 'FC-801SN', fileName: 'TKE-000015', createdAt: '2026-03-31 17:00', status: 'end', isComplete: false},
        {title: '部品Cの図面', modelName: 'FC-701SN', fileName: 'TKE-000021', createdAt: '2026-03-30 12:00', status: 'end', isComplete: true},
        {title: '部品Dの図面', modelName: 'FC-601SN', fileName: 'TKE-000032', createdAt: '2026-03-30 11:30', status: 'end', isComplete: true}
      ]
      return {
        user: payload.user,
        epic: payload.epic,
        group_id: payload.group_id,
        group_status: 'end',
        others: { status_list: MOCK_DATA },
        operations: payload.operations.map(op => ({
          operation: op.operation,
          operation_id: op.operation_id,
          status: op.status
        }))
      };
    }

    if (payload.epic === "drawing-review") {
      type ProcessStatus = 'start' | 'doing' | 'end' | 'error';
      
      interface ProcessItem {
        title: string;
        modelName: string;
        createdAt: string;
        status: ProcessStatus;
      }
      const MOCK_DATA: ProcessItem[] = [
        {title: '図面Eの審査', modelName: 'FC-901SN', createdAt: '2026-04-01 09:30', status: 'doing'},
        {title: '図面Dの審査', modelName: 'FC-901SN', createdAt: '2026-04-01 09:00', status: 'doing'},
        {title: '図面Cの審査', modelName: 'FC-701SN', createdAt: '2026-03-31 17:00', status: 'end'},
        {title: '図面Bの審査', modelName: 'FC-601SN', createdAt: '2026-03-30 12:00', status: 'end'},
        {title: '図面Aの審査', modelName: 'FC-501SN', createdAt: '2026-03-30 11:30', status: 'end'}
      ]
      return {
        user: payload.user,
        epic: payload.epic,
        group_id: payload.group_id,
        group_status: 'end',
        others: { status_list: MOCK_DATA },
        operations: payload.operations.map(op => ({
          operation: op.operation,
          operation_id: op.operation_id,
          status: op.status
        }))
      };
    }

    if (payload.epic === "drawing-highlight") {
      type ProcessStatus = 'start' | 'doing' | 'end' | 'error';
      
      interface ProcessItem {
        title: string;
        modelName: string;
        createdAt: string;
        status: ProcessStatus;
      }
      
      const MOCK_DATA: ProcessItem[] = [
        {title: '部品Aの図面', modelName: 'FC-901SN', createdAt: '2026-04-01 09:30', status: 'end'},
        {title: '部品Aの図面', modelName: 'FC-901SN', createdAt: '2026-04-01 09:00', status: 'end'},
        {title: '部品Bの図面', modelName: 'FC-801SN', createdAt: '2026-03-31 17:00', status: 'end'},
        {title: '部品Cの図面', modelName: 'FC-701SN', createdAt: '2026-03-30 12:00', status: 'end'},
        {title: '部品Dの図面', modelName: 'FC-601SN', createdAt: '2026-03-30 11:30', status: 'end'}
      ]
      return {
        user: payload.user,
        epic: payload.epic,
        group_id: payload.group_id,
        group_status: 'end',
        others: { status_list: MOCK_DATA },
        operations: payload.operations.map(op => ({
          operation: op.operation,
          operation_id: op.operation_id,
          status: op.status
        }))
      };
    }

    if (payload.epic === "drawing-compare") {
      type ProcessStatus = 'start' | 'doing' | 'end' | 'error';
      
      interface ProcessItem {
        title: string;
        modelName: string;
        createdAt: string;
        status: ProcessStatus;
      }
      
      const MOCK_DATA: ProcessItem[] = [
        {title: '図面Eと自社図面2枚との比較', modelName: 'FC-901SN', createdAt: '2026-04-01 09:30', status: 'doing'},
        {title: '図面Dと自社図面1枚との比較', modelName: 'FC-901SN', createdAt: '2026-04-01 09:00', status: 'doing'},
        {title: '図面Cと自社図面3枚との比較', modelName: 'FC-701SN', createdAt: '2026-03-31 17:00', status: 'end'},
        {title: '図面Bと自社図面1枚との比較', modelName: 'FC-601SN', createdAt: '2026-03-30 12:00', status: 'end'},
        {title: '図面Aと自社図面1枚との比較', modelName: 'FC-501SN', createdAt: '2026-03-30 11:30', status: 'end'}
      ]
      return {
        user: payload.user,
        epic: payload.epic,
        group_id: payload.group_id,
        group_status: 'end',
        others: { status_list: MOCK_DATA },
        operations: payload.operations.map(op => ({
          operation: op.operation,
          operation_id: op.operation_id,
          status: op.status
        }))
      };
    }
  }
}
