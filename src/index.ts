import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Define a constant for the output directory in the container
const OUTPUT_DIR = "/output";

/**
 * Main function to initialize and run the MCP server
 */
async function main() {
  // Create the MCP server
  const server = new Server({
    name: "mindmap-converter",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {} // Enable tools capability
    }
  });

  // Register available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "markdown-to-mindmap-content",
          description: "Convert markdown to an interactive mind map and return the HTML content",
          inputSchema: {
            type: "object",
            properties: {
              markdown: { 
                type: "string", 
                description: "Markdown content to convert to mind map" 
              },
              toolbar: { 
                type: "boolean", 
                description: "Whether to show the toolbar in the generated map (default: true)" 
              }
            },
            required: ["markdown"]
          }
        },
        {
          name: "markdown-to-mindmap-file",
          description: "Convert markdown to an interactive mind map and save to a file",
          inputSchema: {
            type: "object",
            properties: {
              markdown: { 
                type: "string", 
                description: "Markdown content to convert to mind map" 
              },
              filename: {
                type: "string",
                description: "Filename for the HTML file (default: auto-generated name)"
              },
              toolbar: { 
                type: "boolean", 
                description: "Whether to show the toolbar in the generated map (default: true)" 
              }
            },
            required: ["markdown"]
          }
        }
      ]
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Common markdown conversion function
    const convertMarkdownToMarkmap = async (
      markdown: string, 
      toolbar: boolean = true,
      outputFilePath?: string
    ) => {
      // Create a temporary directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindmap-'));
      
      // Define file paths
      const mdFilePath = path.join(tempDir, 'input.md');
      let htmlFilePath = outputFilePath;
      
      // If no output path specified, use a temp file
      if (!htmlFilePath) {
        htmlFilePath = path.join(tempDir, 'output.html');
      }
      
      // Write markdown to a temporary file
      await fs.writeFile(mdFilePath, markdown);
      
      // Build command with options
      const toolbarOption = toolbar ? '' : '--no-toolbar';
      
      // Run markmap-cli to convert markdown to HTML
      await execAsync(`markmap --offline --no-open ${toolbarOption} -o "${htmlFilePath}" "${mdFilePath}"`);
      
      // Return both the file path and the temp directory for cleanup
      return { htmlFilePath, tempDir };
    };

    // Return HTML content directly
    if (request.params.name === "markdown-to-mindmap-content") {
      try {
        const args = request.params.arguments as { 
          markdown: string; 
          toolbar?: boolean;
        };
        
        const { htmlFilePath, tempDir } = await convertMarkdownToMarkmap(
          args.markdown, 
          args.toolbar !== false
        );
        
        // Read the generated HTML
        const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
        
        // Clean up temporary files
        await fs.rm(tempDir, { recursive: true, force: true });
        
        return {
          content: [
            {
              type: "text",
              text: htmlContent
            }
          ]
        };
      } catch (err) {
        const error = err as Error;
        console.error('Error converting markdown to mindmap content:', error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error converting markdown to mindmap: ${error.message}`
            }
          ]
        };
      }
    }
    
    // Save to file and return the file path
    if (request.params.name === "markdown-to-mindmap-file") {
      try {
        const args = request.params.arguments as { 
          markdown: string;
          filename?: string;
          toolbar?: boolean;
        };
        
        // Check if OUTPUT_DIR exists and is writable
        try {
          await fs.access(OUTPUT_DIR, fs.constants.W_OK);
        } catch (error) {
          console.error(`Cannot access ${OUTPUT_DIR} for writing:`, error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: The output directory ${OUTPUT_DIR} does not exist or is not writable. Make sure you've properly mounted a volume to the container.`
              }
            ]
          };
        }
        
        // Generate filename if not provided
        const filename = args.filename || 
          `mindmap-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
        
        // Ensure we have an absolute path in the mounted volume
        const containerOutputPath = path.join(OUTPUT_DIR, filename);
        
        // Convert the markdown and save to the specified path
        const { htmlFilePath, tempDir } = await convertMarkdownToMarkmap(
          args.markdown, 
          args.toolbar !== false,
          containerOutputPath
        );
        
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
        
        // Construct the corresponding host path (for display purposes)
        // For example, if container path is /output/file.html, the host path would be /Users/chenyu/Downloads/file.html
        
        return {
          content: [
            {
              type: "text",
              text: `Mind map has been saved to: ${containerOutputPath}\n\nOn your host system, this file is available at: /Users/chenyu/Downloads/${filename}\n\nYou can open this file in any web browser to view the interactive mind map.`
            }
          ]
        };
      } catch (err) {
        const error = err as Error;
        console.error('Error saving markdown to mindmap file:', error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error saving markdown to mindmap file: ${error.message}`
            }
          ]
        };
      }
    }
    
    // Return error if tool not found
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Tool not found: ${request.params.name}`
        }
      ]
    };
  });

  // Connect and start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mindmap converter MCP server running...");
}

// Run the server
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
