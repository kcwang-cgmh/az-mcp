<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Azure DevOps MCP Server Copilot 指示

這是一個 Azure DevOps Model Context Protocol (MCP) Server 專案，用於整合 Azure DevOps Server 與 GitHub Copilot。

## 專案概述

此專案實作了一個 MCP server，讓 GitHub Copilot 可以透過它來：

- 查詢和搜尋工作項目
- 獲取特定工作項目的詳細資訊
- 建立新的工作項目
- 更新現有工作項目
- 執行自訂 WIQL 查詢

## 技術堆疊

- **語言**: TypeScript
- **框架**: Model Context Protocol SDK
- **API 客戶端**: Axios
- **資料驗證**: Zod
- **環境設定**: dotenv

## 開發指導原則

1. **型別安全**: 優先使用 TypeScript 強型別特性
2. **錯誤處理**: 所有 API 呼叫都應該有適當的錯誤處理
3. **中文化**: 所有使用者面向的訊息都應該使用繁體中文
4. **API 相容性**: 支援 Azure DevOps Server API 7.0 版本

## MCP 相關資源

你可以在以下網址找到更多資訊和範例: https://modelcontextprotocol.io/llms-full.txt

## 程式碼約定

- 使用描述性的變數和函式名稱
- 適當的註解和 JSDoc
- 遵循 Azure DevOps REST API 的命名慣例
- 錯誤訊息應該清楚描述問題並提供解決建議
