#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { EACCClient, getNetworkAddresses, ARBITRUM_ONE_MAINNET } from 'eacc-ts';

class EACCMCPServer {
  private server: Server;
  private eaccClient: EACCClient | null = null; 

  constructor() {
    this.server = new Server(
      {
        name: 'eacc-marketplace',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initializeEACCClient() {
    if (this.eaccClient) return;
    
    try {
      console.error('Starting EACC client initialization...');
      const addresses = getNetworkAddresses(ARBITRUM_ONE_MAINNET);
      console.error('Got addresses:', addresses);
      
      this.eaccClient = new EACCClient({
        marketplaceV2Address: addresses.marketplaceV2,
        marketplaceDataV1Address: addresses.marketplaceDataV1,
        chainId: ARBITRUM_ONE_MAINNET,
        ipfsConfig: {
          gateway: 'https://ipfs.io/ipfs/',
          apiEndpoint: 'https://api.pinata.cloud'
        }
      });
      console.error('EACCClient created');
      
      const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
      const dummyPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      // This private key is a well known test key from Hardhat. Do not import it or deposit funds to this wallet.
      // eacc-ts needs to allow non-signer read functionality w/ only provider
      console.error('Connecting with dummy private key for read-only access...');
      await this.eaccClient.connectWithPrivateKey(dummyPrivateKey, rpcUrl);
      console.error('Provider connected');
      console.error('Client methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.eaccClient)));
    } catch (error) {
      console.error('Error during initialization:', error);
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_job_count',
            description: 'Get the total number of jobs on the EACC marketplace',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'search_jobs',
            description: 'Search for jobs on the EACC marketplace with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  description: 'Job status filter (open, taken, completed, etc.)',
                  enum: ['open', 'taken', 'completed', 'closed', 'all']
                },
                category: {
                  type: 'string',
                  description: 'Job category/type filter (digital, video, development, etc.)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of jobs to return',
                  default: 10
                }
              },
            },
          },
          {
            name: 'get_job_details',
            description: 'Get detailed information about a specific job',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'number',
                  description: 'The ID of the job to get details for',
                },
              },
              required: ['jobId'],
            },
          },
          {
            name: 'get_recent_jobs',
            description: 'Get recently created jobs from the marketplace',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of recent jobs to return',
                  default: 10
                }
              },
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.initializeEACCClient();

        if (!this.eaccClient) {
          throw new Error('Failed to initialize EACC client');
        }

        switch (name) {
          case 'get_job_count':
            return await this.getJobCount();

          case 'search_jobs':
            return await this.searchJobs(args as any);

          case 'get_job_details':
            return await this.getJobDetails(args as any);

          case 'get_recent_jobs':
            return await this.getRecentJobs(args as any);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async getJobCount() {
    try {
      console.error('getJobCount called');
      if (!this.eaccClient) throw new Error('Client not initialized');
      console.error('Client exists, checking methods...');
      console.error('getJobsLength method exists:', typeof this.eaccClient.getJobsLength);
      
      const count = await this.eaccClient.getJobsLength();
      console.error('Got count:', count);
      
      return {
        content: [
          {
            type: 'text',
            text: `There are currently ${count} jobs on the EACC marketplace.`,
          },
        ],
      };
    } catch (error) {
      console.error('Error in getJobCount:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get job count: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async searchJobs(args: { status?: string; category?: string; limit?: number }) {
    try {
      if (!this.eaccClient) throw new Error('Client not initialized');
      
      const { status, category, limit = 10 } = args;
      
      const totalJobs = await this.eaccClient.getJobsLength();
      console.error(`Total jobs in marketplace: ${totalJobs}`);
      
      if ((totalJobs as number) === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No jobs found on the marketplace.`,
            },
          ],
        };
      }
      
      const batchSize = 20;
      const maxJobsToFetch = Math.min(totalJobs as number, limit * 3);
      let allJobs: any[] = [];
      
      for (let start = 0; start < maxJobsToFetch && allJobs.length < limit; start += batchSize) {
        const end = Math.min(start + batchSize, maxJobsToFetch);
        console.error(`Fetching jobs ${start} to ${end-1}`);
        
        try {
          const batch = await this.eaccClient.getJobs(start, end);
          allJobs = allJobs.concat(batch);
        } catch (batchError) {
          console.error(`Error fetching batch ${start}-${end}:`, batchError);
        }
      }
      
      let filteredJobs = allJobs;
      
      if (status && status !== 'all') {
        filteredJobs = filteredJobs.filter(job => 
          job.status?.toLowerCase() === status.toLowerCase()
        );
      }
      
      if (category) {
        filteredJobs = filteredJobs.filter(job => 
          job.title?.toLowerCase().includes(category.toLowerCase()) ||
          job.description?.toLowerCase().includes(category.toLowerCase()) ||
          job.tags?.some((tag: string) => tag.toLowerCase().includes(category.toLowerCase()))
        );
      }
      
      const jobs = filteredJobs.slice(0, limit);

      if (jobs.length === 0) {
        const filterText = status || category ? 
          ` matching your criteria (status: ${status || 'any'}, category: ${category || 'any'})` : 
          '';
        return {
          content: [
            {
              type: 'text',
              text: `No jobs found${filterText}.`,
            },
          ],
        };
      }

      const jobList = jobs.map((job, index) => {
        const paymentInfo = job.paymentAmount ? ` - ${job.paymentAmount} ETH` : '';
        const statusInfo = job.status ? ` - ${job.status}` : '';
        return `${index + 1}. Job #${job.id}: ${job.title || 'Untitled'}${statusInfo}${paymentInfo}`;
      }).join('\n');

      const filterSummary = [];
      if (status && status !== 'all') filterSummary.push(`status: ${status}`);
      if (category) filterSummary.push(`category: ${category}`);
      const filterText = filterSummary.length > 0 ? ` (filtered by ${filterSummary.join(', ')})` : '';

      return {
        content: [
          {
            type: 'text',
            text: `Found ${jobs.length} of ${totalJobs} total jobs${filterText}:\n\n${jobList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search jobs: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async getJobDetails(args: { jobId: number }) {
    try {
      if (!this.eaccClient) throw new Error('Client not initialized');
      
      const { jobId } = args;
      const job = await this.eaccClient.getJob(jobId);
      
      if (!job) {
        return {
          content: [
            {
              type: 'text',
              text: `Job #${jobId} not found.`,
            },
          ],
        };
      }

      const details = `Job #${jobId} Details:
Title: ${job.title || 'Untitled'}
Content hash: ${job.contentHash || 'No content available'}
Payment: ${job.amount || 'TBD'}
Status: ${job.state || 'Unknown'}
Owner: ${job.roles?.creator || 'Unknown'}
${job.roles?.worker ? `Worker: ${job.roles.worker}` : ''}
Created: ${job.timestamp ? new Date((job.timestamp as number) * 1000).toLocaleString() : 'Unknown'}`;

      return {
        content: [
          {
            type: 'text',
            text: details,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get job details: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async getRecentJobs(args: { limit?: number }) {
    try {
      if (!this.eaccClient) throw new Error('Client not initialized');
      const { limit = 10 } = args;
      const totalJobs = await this.eaccClient.getJobsLength();
      
      if ((totalJobs as number) === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No jobs found on the marketplace.`,
            },
          ],
        };
      }
      
      const startIndex = Math.max(0, (totalJobs as number) - limit);
      const recentJobs = await this.eaccClient.getJobs(startIndex, totalJobs as number);
      const sortedJobs = recentJobs.reverse();

      if (sortedJobs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No recent jobs found.`,
            },
          ],
        };
      }

      const jobList = sortedJobs.map((job, index) => {
        const timeInfo = job.timestamp 
          ? ` - ${new Date((job.timestamp as number) * 1000).toLocaleString()}`
          : '';
        return `${index + 1}. Escrow ID ${job.escrowId}: ${job.title || 'Untitled'}${timeInfo}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Most recent jobs (${sortedJobs.length} found):\n\n${jobList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get recent jobs: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('EACC MCP server running on stdio');
  }
}

const server = new EACCMCPServer();
server.run().catch(console.error);