# ADF Migration & Transition Guide

This guide explains how to transition from legacy Wiki/Markdown rendering to the modern **Atlassian Document Format (ADF)** in Jira Cloud. It covers detection, configuration, migration, API conversion, and Forge app implementation.

## 1. Detect Renderer Type (Wiki vs ADF)

To determine if a field (like `description`) is using the Wiki Renderer or ADF, you can inspect the issue's edit metadata via the Jira REST API.

**API Request:**

```http
GET /rest/api/3/issue/{issueIdOrKey}/editmeta
```

**Response Analysis:**
Look for the field in the `fields` object.

- **ADF (Modern)**:
  - `schema.type` is `"doc"` (for custom fields) or strict ADF system field.
  - In modern Jira Cloud, `description` often still shows `schema.type: "string"` but behaves as ADF if the _Renderer_ is set to "Atlassian Document Format".
  - **Definitive Check**: Look at the actual issue data.
    - If the returned value of the field is a **JSON Object** (`{"version": 1, "type": "doc", ...}`), it is **ADF**.
    - If it is a **String** (`"h1. Title\n* bullet"`), it is **Wiki Markup**.

**Forge Example:**

```javascript
const res = await requestJira(
  `/rest/api/3/issue/${issueId}?expand=names,schema`,
);
const data = await res.json();
const desc = data.fields.description;

if (typeof desc === "object" && desc.type === "doc") {
  console.log("Field is ADF");
} else {
  console.log("Field is Wiki/String");
}
```

---

## 2. Change Field Configuration (Jira Admin)

To force a field to use the ADF Editor:

1.  Go to **Jira Settings** (cog icon) > **Issues**.
2.  Select **Field Configurations** in the left sidebar.
3.  Locate the Field Configuration Scheme used by your project (or the "Default Field Configuration").
4.  Click **Configure**.
5.  Find the `Description` field (or your custom field).
6.  Right-click or hover over the action area and select **Renderers** (if available).
    - _Note: For some system fields in generic projects, this might be locked to "Default Text Renderer" (Wiki) or auto-migrated._
7.  Select **Atlassian Document Format** (sometimes labeled "Wiki Style Renderer" in older transitions, but modern Cloud uses ADF by default for "Smart" fields).

_If "Atlassian Document Format" is selected, the API will expect ADF JSON._

---

## 3. Migrate Data (Wiki -> ADF)

If you cannot change the renderer of an existing field (e.g., restricted system field), creates a new custom field.

1.  **Create Custom Field**:
    - Type: **Paragraph** (supports rich text/ADF).
    - Name: "Modern Description" (example).
2.  **Migrate Data (Script)**:
    - Read old field (Wiki String).
    - Convert to ADF (see Section 4).
    - Write to new field.

---

## 4. Convert Wiki to ADF (REST API & Logic)

Jira does not provide a public "String -> ADF" conversion endpoint for generic text. However, you have two options:

### Option A: Basic Wrapping (Safe Fallback)

Wrap the plain text in a basic ADF paragraph node. This preserves text but loses formatting (bold, headers).

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Original Wiki Text Here"
        }
      ]
    }
  ]
}
```

### Option B: Client-Side Conversion (@atlaskit)

If building a custom UI (like this Forge app), use proper Atlassian libraries.
_Unfortunately, the full editor core is heavy._
You can implement a lightweight parser to map Markdown/Wiki to ADF:

- `# Header` -> `heading` node.
- `* Bold` -> `text` node with `marks: [{"type": "strong"}]`.

**Example ADF Structure:**

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "My Title" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Some text." }]
    }
  ]
}
```

---

## 5. Forge App Implementation

When writing to an ADF field from Forge, you **must** send a valid ADF JSON object, usually via the `body` prop in `updateIssue`.

**Writing ADF (Code Example):**

```javascript
// Construct ADF Object
const adfBody = {
  version: 1,
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: MyPlainTextDescription,
        },
      ],
    },
  ],
};

// Send to Jira
await requestJira(`/rest/api/3/issue/${issueKey}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: {
      description: adfBody, // Send Object, NOT string
    },
  }),
});
```

**Reading ADF:**
Always check type.

```javascript
const desc = issue.fields.description;
const textToDisplay =
  typeof desc === "string" ? desc : extractTextFromADF(desc);
```

_The helper `extractTextFromADF` (already in your codebase) handles the parsing of complex ADF into readable text._
