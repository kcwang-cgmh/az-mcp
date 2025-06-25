# Azure DevOps MCP Server

一個用於整合 Azure DevOps Server 的 Model Context Protocol (MCP) 伺服器，讓 GitHub Copilot 可以直接與您的 Azure DevOps 工作項目進行互動。

## 功能特色

- 🔍 **查詢工作項目**：透過關鍵字搜尋工作項目
- 📋 **獲取詳細資訊**：查看特定工作項目的完整詳情
- ➕ **建立工作項目**：建立新的 Bug、任務、使用者劇本等
- ✏️ **更新工作項目**：修改標題、描述、狀態、指派等欄位
- 🔎 **自訂查詢**：執行 WIQL (Work Item Query Language) 查詢

## 系統需求

- Node.js 18 或更高版本
- TypeScript 5.0 或更高版本
- Azure DevOps Server 存取權限
- 有效的 Personal Access Token (PAT)

## 安裝與設定

### 1. 複製專案

```pwsh
# Windows PowerShell
git clone <repository-url>
cd az-mcp
```

### 2. 安裝相依套件

```pwsh
npm install
```

### 3. （選用）全域安裝 MCP Server

若需於多個專案或全系統使用，可將本專案全域安裝：

```pwsh
npm install -g .
```

安裝後，系統會於全域 node_modules/bin 產生 `az-mcp` 執行檔，可直接於命令列或 VS Code 設定中呼叫。

### 4. 設定環境變數

複製 `.env.example` 為 `.env`，並依需求填入 Azure DevOps 設定：

```pwsh
cp .env.example .env
# 或手動建立 .env 並填入下列內容
```

`.env` 範例：

```env
AZURE_DEVOPS_URL=https://your-devops-server.com
AZURE_DEVOPS_ORGANIZATION=your-organization
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_TOKEN=your-personal-access-token
API_VERSION=7.0
DEBUG=false
```

### 5. 建構專案

```pwsh
npm run build
```

### 6. 啟動伺服器

#### 正式執行

```pwsh
npm start
```

#### 開發模式（自動重建與執行）

```pwsh
npm run dev
```

---

## 整合與使用方式

### 在 VS Code 中偵錯或連接全域 MCP Server

建立或編輯 `.vscode/mcp.json`：

#### 使用本地建構檔案

```json
{
  "servers": {
    "azure-devops-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["./build/index.js"]
    }
  }
}
```

#### 使用全域安裝的 MCP Server

若已全域安裝，可直接指定全域執行檔（Windows 範例）：

```json
{
  "servers": {
    "azure-devops-mcp": {
      "type": "stdio",
      "command": "az-mcp"
    }
  }
}
```

> 若無法直接呼叫 `az-mcp`，請確認全域 node_modules/.bin 已加入 PATH，或於 `command` 欄位填入完整路徑。

#### 加入環境變數（env）範例

若需於 VS Code 偵錯時直接注入環境變數，可於 `azure-devops-mcp` 物件中加入 `env` 欄位：

```json
{
  "servers": {
    "azure-devops-mcp": {
      "type": "stdio",
      "command": "az-mcp",
      "env": {
        "AZURE_DEVOPS_URL": "https://your-devops-server.com",
        "AZURE_DEVOPS_ORGANIZATION": "your-organization",
        "AZURE_DEVOPS_PROJECT": "your-project",
        "AZURE_DEVOPS_TOKEN": "your-personal-access-token",
        "API_VERSION": "7.0",
        "DEBUG": "false"
      }
    }
  }
}
```

> 如有 `env` 欄位，會優先於 `.env` 檔案設定。建議敏感資訊仍以 `.env` 管理，僅於特殊需求下於此明確指定。

---

### 在 Visual Studio 2022 中整合 MCP Server

Visual Studio 2022 17.14 版（或更新）已原生支援 MCP 伺服器，可直接於 Copilot 代理程式模式下連線與管理。

#### 步驟說明

1. 建立 MCP 組態檔：於方案根目錄（或 `%USERPROFILE%` 全域）建立 `.mcp.json` 或 `mcp.json`。
2. 編輯組態檔，加入 MCP Server 設定。例如：

  ```json
  {
    "servers": {
      "azure-devops-mcp": {
        "type": "stdio",
        "command": "az-mcp"
      }
    }
  }
  ```

- 若需傳遞環境變數，可加入 `env` 欄位。
- 若未全域安裝，請將 `command` 改為 `node` 並指定 `args` 為 MCP Server 路徑。

3. 組態檔可放置於下列任一位置，Visual Studio 會自動偵測：

   - `%USERPROFILE%\.mcp.json`（全域）
   - `<SOLUTIONDIR>\.vs\mcp.json`（僅限該方案）
   - `<SOLUTIONDIR>\.mcp.json`（建議原始碼控管）
   - `<SOLUTIONDIR>\.vscode\mcp.json`（跨 VS Code/VS 共用）

4. 於 Visual Studio 啟動方案後，Copilot Chat 視窗右上角「Ask」下拉選單選擇「Agent」，即可選用自訂 MCP Server。
5. 首次使用時，若工具需權限，請依提示授權。

> 詳細官方說明請參考：[Visual Studio 使用 MCP 伺服器（預覽）](https://learn.microsoft.com/zh-tw/visualstudio/ide/mcp-servers?view=vs-2022)

---

### 在 Claude Desktop 中配置 MCP Server

1. 編輯 `claude_desktop_config.json`，於 `mcpServers` 區段加入 Azure DevOps MCP Server 設定。
2. 範例如下：

#### Windows 範例

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["C:\\完整路徑\\az-mcp\\build\\index.js"]
    }
  }
}
```

#### macOS/Linux 範例

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/完整/路徑/az-mcp/build/index.js"]
    }
  }
}
```

> 請將 `完整路徑` 替換為實際 MCP Server 的 build/index.js 絕對路徑。
> 建議於專案根目錄設定 `.env` 檔案，或於啟動前設定好相關環境變數。

---

## 可用工具與 API 參數

### 1. query-work-items

查詢和搜尋工作項目。

- `query` (選用)：搜尋關鍵字
- `top` (選用)：回傳項目數量上限（預設 10）

### 2. get-work-item

獲取特定工作項目的詳細資訊。

- `id`：工作項目 ID

### 3. create-work-item

建立新的工作項目。

- `workItemType`：工作項目類型（Bug、Task、User Story、Feature 等）
- `title`：標題
- `description` (選用)：描述
- `assignedTo` (選用)：指派對象

### 4. update-work-item

更新現有工作項目。

- `id`：工作項目 ID
- `title` (選用)：新標題
- `description` (選用)：新描述
- `state` (選用)：新狀態
- `assignedTo` (選用)：指派對象
- `priority` (選用)：優先順序（1-4）
- `severity` (選用)：嚴重性

### 5. execute-wiql-query

執行自訂 WIQL 查詢。

- `wiql`：WIQL 查詢語句

---

## 常用範例

- 顯示最近 10 個工作項目
- 搜尋包含「登入」的工作項目
- 建立一個新的 Bug，標題為「無法登入系統」
- 將工作項目 123 的狀態更新為「Resolved」
- 查詢所有指派給 John 的高優先順序工作項目

---

## 專案結構

```txt
az-mcp/
├── src/
│   └── index.ts          # 主要伺服器程式碼
├── build/                # 編譯後的 JavaScript 檔案
├── .env.example          # 環境變數範例
├── .github/
│   └── copilot-instructions.md
├── .vscode/
│   ├── mcp.json          # MCP 偵錯設定
│   └── tasks.json        # VS Code 任務
├── package.json
├── tsconfig.json
└── README.md
```

---

## NPM 指令

- `npm run build`：建構 TypeScript 程式碼
- `npm start`：執行伺服器
- `npm run dev`：開發模式（自動建構與執行）
- `npm run clean`：清理建構檔案

---

## 偵錯與疑難排解

1. 確認已建構專案（`npm run build`）
2. 使用 VS Code 的 MCP 偵錯功能
3. 檢查 Debug Console 或 log 檔案

### 常見問題

- **認證失敗**：確認 PAT 有效且權限正確，並檢查 Azure DevOps URL
- **連線問題**：確認網路與防火牆設定
- **工具未顯示**：檢查 MCP 設定檔路徑，並重新啟動 Claude Desktop 或 VS Code

### 記錄檔位置

- Claude Desktop：`~/Library/Logs/Claude/mcp-server-azure-devops.log`
- VS Code：Debug Console

---

## 支援與參考

- [Azure DevOps REST API 文件](https://docs.microsoft.com/zh-tw/rest/api/azure/devops/)
- [Model Context Protocol 文件](https://modelcontextprotocol.io/)
- 本專案 GitHub Issues
