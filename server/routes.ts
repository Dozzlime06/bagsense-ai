import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerChatRoutes } from "./chat";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register chat routes
  registerChatRoutes(app);

  return httpServer;
}
