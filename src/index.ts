#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios, { AxiosInstance } from "axios";
import * as dotenv from "dotenv";
import * as https from "https";
import { z } from "zod";

// 載入環境變數
dotenv.config();

// 語言設定和工作項目類型對應
const LANGUAGE = process.env.LANGUAGE || "en";

const WORK_ITEM_TYPES = {
  en: {
    bug: "Bug",
    task: "Task",
    userStory: "User Story",
    feature: "Feature",
    pbi: "Product Backlog Item"
  },
  "zh-tw": {
    bug: "bug",
    task: "工作",
    userStory: "使用者故事",
    feature: "功能",
    pbi: "產品待辦項目"
  }
};

// 取得工作項目類型提示
function getWorkItemTypeHint(): string {
  const types = WORK_ITEM_TYPES[LANGUAGE as keyof typeof WORK_ITEM_TYPES] || WORK_ITEM_TYPES.en;
  return `工作項目類型（例如：${Object.values(types).join(', ')}）`;
}

// Azure DevOps API 客戶端介面
interface AzureDevOpsClient {
  getWorkItems(query?: string): Promise<WorkItem[]>;
  getWorkItem(id: number): Promise<WorkItem>;
  createWorkItem(workItemType: string, title: string, description?: string, assignedTo?: string, acceptanceCriteria?: string): Promise<WorkItem>;
  updateWorkItem(id: number, updates: WorkItemUpdate[]): Promise<WorkItem>;
  queryWorkItems(wiql: string): Promise<WorkItemQueryResult>;
  getWorkItemsBatch(ids: number[]): Promise<WorkItem[]>;
}

// 工作項目介面
interface WorkItem {
  id: number;
  rev: number;
  fields: {
    "System.Id": number;
    "System.Title": string;
    "System.WorkItemType": string;
    "System.State": string;
    "System.AssignedTo"?: {
      displayName: string;
      uniqueName: string;
    };
    "System.Description"?: string;
    "System.CreatedDate": string;
    "System.ChangedDate": string;
    "System.AreaPath": string;
    "System.IterationPath": string;
    "Microsoft.VSTS.Common.Priority"?: number;
    "Microsoft.VSTS.Common.Severity"?: string;
    "Microsoft.VSTS.Common.AcceptanceCriteria"?: string;
    [key: string]: any;
  };
  _links?: any;
  url?: string;
}

// 工作項目更新介面
interface WorkItemUpdate {
  op: "add" | "replace" | "remove";
  path: string;
  value?: any;
}

// 查詢結果介面
interface WorkItemQueryResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  columns: any[];
  workItems: { id: number; url: string }[];
}

// Azure DevOps 客戶端實作
class AzureDevOpsClientImpl implements AzureDevOpsClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private organization: string;
  private project: string;

  constructor() {
    const url = process.env.AZURE_DEVOPS_URL;
    const token = process.env.AZURE_DEVOPS_TOKEN;
    this.organization = process.env.AZURE_DEVOPS_ORGANIZATION || "";
    this.project = process.env.AZURE_DEVOPS_PROJECT || "";
    const apiVersion = process.env.API_VERSION || "6.0";

    if (!url || !token || !this.organization || !this.project) {
      throw new Error("缺少必要的環境變數: AZURE_DEVOPS_URL, AZURE_DEVOPS_TOKEN, AZURE_DEVOPS_ORGANIZATION, AZURE_DEVOPS_PROJECT");
    }

    this.baseUrl = `${url}/${this.organization}/${this.project}/_apis`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Authorization": `Basic ${Buffer.from(`:${token}`).toString("base64")}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      params: {
        "api-version": apiVersion
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
  }

  async getWorkItems(query?: string): Promise<WorkItem[]> {
    try {
      let wiql = "SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems";

      if (query) {
        wiql += ` WHERE [System.Title] CONTAINS '${query}' OR [System.Description] CONTAINS '${query}'`;
      }

      wiql += " ORDER BY [System.ChangedDate] DESC";

      const queryResult = await this.queryWorkItems(wiql);

      if (queryResult.workItems.length === 0) {
        return [];
      }

      const ids = queryResult.workItems.map(wi => wi.id);
      const response = await this.client.get(`/wit/workitems`, {
        params: {
          ids: ids.join(","),
          "$expand": "Fields",
          "api-version": "6.0"
        }
      });

      return response.data.value;
    } catch (error) {
      console.error("獲取工作項目時發生錯誤:", error);
      throw new Error(`無法獲取工作項目: ${error}`);
    }
  }

  async getWorkItem(id: number): Promise<WorkItem> {
    try {
      const response = await this.client.get(`/wit/workitems/${id}`, {
        params: {
          "$expand": "Fields",
          "api-version": "6.0"
        }
      });
      return response.data;
    } catch (error) {
      console.error(`獲取工作項目 ${id} 時發生錯誤:`, error);
      throw new Error(`無法獲取工作項目 ${id}: ${error}`);
    }
  }

  async createWorkItem(workItemType: string, title: string, description?: string, assignedTo?: string, acceptanceCriteria?: string): Promise<WorkItem> {
    try {
      const fields: WorkItemUpdate[] = [
        {
          op: "add",
          path: "/fields/System.Title",
          value: title
        }
      ];

      if (description) {
        fields.push({
          op: "add",
          path: "/fields/System.Description",
          value: description
        });
      }

      if (assignedTo) {
        fields.push({
          op: "add",
          path: "/fields/System.AssignedTo",
          value: assignedTo
        });
      }

      if (acceptanceCriteria) {
        fields.push({
          op: "add",
          path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
          value: acceptanceCriteria
        });
      }

      const response = await this.client.post(`/wit/workitems/$${workItemType}`, fields, {
        headers: {
          "Content-Type": "application/json-patch+json"
        },
        params: {
          "api-version": "6.0"
        }
      });

      return response.data;
    } catch (error) {
      console.error("建立工作項目時發生錯誤:", error);
      throw new Error(`無法建立工作項目: ${error}`);
    }
  }

  async updateWorkItem(id: number, updates: WorkItemUpdate[]): Promise<WorkItem> {
    try {
      const response = await this.client.patch(`/wit/workitems/${id}`, updates, {
        headers: {
          "Content-Type": "application/json-patch+json"
        },
        params: {
          "api-version": "6.0"
        }
      });

      return response.data;
    } catch (error) {
      console.error(`更新工作項目 ${id} 時發生錯誤:`, error);
      throw new Error(`無法更新工作項目 ${id}: ${error}`);
    }
  }

  async queryWorkItems(wiql: string): Promise<WorkItemQueryResult> {
    try {
      const response = await this.client.post("/wit/wiql", {
        query: wiql
      }, {
        params: {
          "api-version": "6.0"
        }
      });

      return response.data;
    } catch (error) {
      console.error("查詢工作項目時發生錯誤:", error);
      throw new Error(`無法查詢工作項目: ${error}`);
    }
  }

  async getWorkItemsBatch(ids: number[]): Promise<WorkItem[]> {
    try {
      const response = await this.client.get(`/wit/workitems`, {
        params: {
          ids: ids.join(","),
          "$expand": "Fields",
          "api-version": "6.0"
        }
      });
      return response.data.value;
    } catch (error) {
      console.error("批次獲取工作項目時發生錯誤:", error);
      throw new Error(`無法批次獲取工作項目: ${error}`);
    }
  }
}

// 建立 MCP Server
const server = new McpServer({
  name: "azure-devops-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// 初始化 Azure DevOps 客戶端
let azureClient: AzureDevOpsClient;

try {
  azureClient = new AzureDevOpsClientImpl();
} catch (error) {
  console.error("初始化 Azure DevOps 客戶端失敗:", error);
  process.exit(1);
}

// 工具：查詢工作項目
server.tool(
  "query-work-items",
  "查詢 Azure DevOps 工作項目",
  {
    query: z.string().optional().describe("搜尋關鍵字（標題或描述）"),
    top: z.number().optional().default(10).describe("回傳項目數量上限")
  },
  async ({ query, top }) => {
    try {
      const workItems = await azureClient.getWorkItems(query);
      const limitedItems = workItems.slice(0, top);

      const formattedItems = limitedItems.map(item => {
        const fields = item.fields;
        return `ID: ${fields["System.Id"]}
標題: ${fields["System.Title"]}
類型: ${fields["System.WorkItemType"]}
狀態: ${fields["System.State"]}
指派給: ${fields["System.AssignedTo"]?.displayName || "未指派"}
建立日期: ${new Date(fields["System.CreatedDate"]).toLocaleString("zh-TW")}
最後修改: ${new Date(fields["System.ChangedDate"]).toLocaleString("zh-TW")}
---`;
      });

      const result = `找到 ${workItems.length} 個工作項目${query ? `（搜尋: "${query}"）` : ""}：

${formattedItems.join("\n")}`;

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `查詢工作項目時發生錯誤: ${error}`,
          },
        ],
      };
    }
  }
);

// 工具：獲取特定工作項目詳情
server.tool(
  "get-work-item",
  "獲取特定工作項目的詳細資訊",
  {
    id: z.number().describe("工作項目 ID")
  },
  async ({ id }) => {
    try {
      const workItem = await azureClient.getWorkItem(id);
      const fields = workItem.fields;

      const details = `工作項目詳情:

ID: ${fields["System.Id"]}
標題: ${fields["System.Title"]}
類型: ${fields["System.WorkItemType"]}
狀態: ${fields["System.State"]}
指派給: ${fields["System.AssignedTo"]?.displayName || "未指派"}
區域路徑: ${fields["System.AreaPath"]}
反復運算路徑: ${fields["System.IterationPath"]}
優先順序: ${fields["Microsoft.VSTS.Common.Priority"] || "未設定"}
嚴重性: ${fields["Microsoft.VSTS.Common.Severity"] || "未設定"}
建立日期: ${new Date(fields["System.CreatedDate"]).toLocaleString("zh-TW")}
最後修改: ${new Date(fields["System.ChangedDate"]).toLocaleString("zh-TW")}

描述:
${fields["System.Description"] || "無描述"}

驗收條件:
${fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "未設定"}`;

      return {
        content: [
          {
            type: "text",
            text: details,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `獲取工作項目時發生錯誤: ${error}`,
          },
        ],
      };
    }
  }
);

// 工具：建立新工作項目
server.tool(
  "create-work-item",
  "建立新的工作項目",
  {
    workItemType: z.string().describe(getWorkItemTypeHint()),
    title: z.string().describe("工作項目標題"),
    description: z.string().optional().describe("工作項目描述"),
    assignedTo: z.string().optional().describe("指派給的使用者電子郵件或顯示名稱"),
    acceptanceCriteria: z.string().optional().describe("驗收條件（適用於 Bug, Epic, Feature, Product Backlog Item）")
  },
  async ({ workItemType, title, description, assignedTo, acceptanceCriteria }) => {
    try {
      const workItem = await azureClient.createWorkItem(workItemType, title, description, assignedTo, acceptanceCriteria);
      const fields = workItem.fields;

      let result = `成功建立工作項目:

ID: ${fields["System.Id"]}
標題: ${fields["System.Title"]}
類型: ${fields["System.WorkItemType"]}
狀態: ${fields["System.State"]}
指派給: ${fields["System.AssignedTo"]?.displayName || "未指派"}
建立日期: ${new Date(fields["System.CreatedDate"]).toLocaleString("zh-TW")}`;

      // 如果有 acceptance criteria，顯示它
      if (fields["Microsoft.VSTS.Common.AcceptanceCriteria"]) {
        result += `

驗收條件:
${fields["Microsoft.VSTS.Common.AcceptanceCriteria"]}`;
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `建立工作項目時發生錯誤: ${error}`,
          },
        ],
      };
    }
  }
);

// 工具：更新工作項目
server.tool(
  "update-work-item",
  "更新現有工作項目",
  {
    id: z.number().describe("工作項目 ID"),
    title: z.string().optional().describe("新標題"),
    description: z.string().optional().describe("新描述"),
    state: z.string().optional().describe("新狀態（例如：Active, Resolved, Closed）"),
    assignedTo: z.string().optional().describe("指派給的使用者電子郵件或顯示名稱"),
    priority: z.number().optional().describe("優先順序（1-4）"),
    severity: z.string().optional().describe("嚴重性（例如：1 - Critical, 2 - High, 3 - Medium, 4 - Low）"),
    acceptanceCriteria: z.string().optional().describe("驗收條件（適用於 Bug, Epic, Feature, Product Backlog Item）")
  },
  async ({ id, title, description, state, assignedTo, priority, severity, acceptanceCriteria }) => {
    try {
      const updates: WorkItemUpdate[] = [];

      if (title) {
        updates.push({
          op: "replace",
          path: "/fields/System.Title",
          value: title
        });
      }

      if (description) {
        updates.push({
          op: "replace",
          path: "/fields/System.Description",
          value: description
        });
      }

      if (state) {
        updates.push({
          op: "replace",
          path: "/fields/System.State",
          value: state
        });
      }

      if (assignedTo) {
        updates.push({
          op: "replace",
          path: "/fields/System.AssignedTo",
          value: assignedTo
        });
      }

      if (priority) {
        updates.push({
          op: "replace",
          path: "/fields/Microsoft.VSTS.Common.Priority",
          value: priority
        });
      }

      if (severity) {
        updates.push({
          op: "replace",
          path: "/fields/Microsoft.VSTS.Common.Severity",
          value: severity
        });
      }

      if (acceptanceCriteria) {
        updates.push({
          op: "replace",
          path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
          value: acceptanceCriteria
        });
      }

      if (updates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "沒有提供要更新的欄位。",
            },
          ],
        };
      }

      const workItem = await azureClient.updateWorkItem(id, updates);
      const fields = workItem.fields;

      let result = `成功更新工作項目:

ID: ${fields["System.Id"]}
標題: ${fields["System.Title"]}
類型: ${fields["System.WorkItemType"]}
狀態: ${fields["System.State"]}
指派給: ${fields["System.AssignedTo"]?.displayName || "未指派"}
最後修改: ${new Date(fields["System.ChangedDate"]).toLocaleString("zh-TW")}`;

      // 如果有 acceptance criteria，顯示它
      if (fields["Microsoft.VSTS.Common.AcceptanceCriteria"]) {
        result += `

驗收條件:
${fields["Microsoft.VSTS.Common.AcceptanceCriteria"]}`;
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `更新工作項目時發生錯誤: ${error}`,
          },
        ],
      };
    }
  }
);

// 工具：執行自訂 WIQL 查詢
server.tool(
  "execute-wiql-query",
  "執行自訂的 Work Item Query Language (WIQL) 查詢",
  {
    wiql: z.string().describe("WIQL 查詢語句")
  },
  async ({ wiql }) => {
    try {
      const queryResult = await azureClient.queryWorkItems(wiql);

      if (queryResult.workItems.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "查詢沒有找到任何工作項目。",
            },
          ],
        };
      }

      // 獲取工作項目詳情
      const ids = queryResult.workItems.map(wi => wi.id);
      const workItems: WorkItem[] = [];

      // 分批獲取工作項目以避免 URL 長度限制
      const batchSize = 200;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        try {
          const batchItems = await azureClient.getWorkItemsBatch(batchIds);
          workItems.push(...batchItems);
        } catch (error) {
          console.error(`批次 ${i}-${i + batchSize} 獲取失敗:`, error);
        }
      }

      const formattedItems = workItems.map(item => {
        const fields = item.fields;
        return `ID: ${fields["System.Id"]}
標題: ${fields["System.Title"]}
類型: ${fields["System.WorkItemType"]}
狀態: ${fields["System.State"]}
指派給: ${fields["System.AssignedTo"]?.displayName || "未指派"}
---`;
      });

      const result = `WIQL 查詢結果（共 ${workItems.length} 個項目）:

查詢: ${wiql}

${formattedItems.join("\n")}`;

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `執行 WIQL 查詢時發生錯誤: ${error}`,
          },
        ],
      };
    }
  }
);

// 啟動服務器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Azure DevOps MCP Server 正在執行於 stdio");
}

main().catch((error) => {
  console.error("主函式發生嚴重錯誤:", error);
  process.exit(1);
});
