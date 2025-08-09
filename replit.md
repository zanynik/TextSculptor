# Overview

This is a full-stack text processing and organization application built with React, Express, and TypeScript. The application allows users to upload plain text files, which are then automatically chunked, embedded using OpenAI, and organized into a hierarchical book structure with chapters and sections using AI-powered clustering. Users can view, edit, and navigate through their organized content in an intuitive interface with real-time updates.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side is built as a single-page React application using modern patterns:

- **React 18** with functional components and hooks for state management
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query (React Query)** for server state management, caching, and synchronization
- **Tailwind CSS** with shadcn/ui components for consistent, accessible UI design
- **TypeScript** throughout for type safety and better developer experience

The frontend follows a component-based architecture with clear separation between UI components (`/components/ui/`), business logic components (`/components/`), and pages (`/pages/`). State management is handled primarily through React Query for server state and local React state for UI state.

## Backend Architecture

The server is built with Express.js following RESTful API principles:

- **Express.js** server with TypeScript for the main API layer
- **Drizzle ORM** for database interactions with PostgreSQL schema definitions
- **In-memory storage** as the default storage layer with interface abstraction for easy database integration
- **Modular service layer** separating concerns like OpenAI integration, vector operations, and clustering algorithms

The backend architecture uses dependency injection patterns with storage abstraction, making it easy to swap between in-memory storage and database implementations. The API layer is cleanly separated from business logic through service classes.

## Database Design

The application uses a hierarchical data model:

- **Books** - Top-level containers for uploaded text content
- **Chapters** - Major sections within books, determined by clustering
- **Sections** - Sub-sections within chapters for finer organization  
- **Chunks** - Individual text segments with embeddings for semantic search

The schema includes proper relationships between entities and supports both content management and vector search capabilities through embedding storage.

## AI and ML Integration

The system leverages OpenAI for intelligent text processing:

- **GPT-4o** for semantic text chunking and title generation
- **Text embedding models** for generating vector representations of text chunks
- **Batch processing** for efficient embedding generation
- **Custom K-means clustering** algorithm for organizing chunks into logical chapters and sections

The AI integration is designed to be modular, with clear abstractions that allow for easy substitution of different AI providers or models.

## File Processing Pipeline

Text processing follows a multi-stage pipeline:

1. **File Upload** - Accepts .txt files with size limits and validation
2. **AI Chunking** - Uses OpenAI to intelligently segment text into coherent chunks
3. **Embedding Generation** - Creates vector embeddings for semantic search
4. **Clustering** - Groups related chunks using K-means algorithm
5. **Structure Organization** - Arranges clusters into hierarchical book structure
6. **Storage** - Persists the organized content with metadata

This pipeline is designed to handle various text formats and can be extended to support additional file types.

# External Dependencies

## AI Services
- **OpenAI API** - GPT-4o for text processing and embedding generation
- Custom API key configuration through environment variables

## Database
- **PostgreSQL** - Primary database with Neon serverless hosting support
- **Drizzle ORM** - Type-safe database operations and migrations
- Connection pooling and environment-based configuration

## UI Framework
- **shadcn/ui** - Component library built on Radix UI primitives
- **Tailwind CSS** - Utility-first styling framework
- **Radix UI** - Accessible, unstyled component primitives

## Development Tools
- **Vite** - Fast build tool and development server
- **TypeScript** - Static type checking across the entire stack
- **ESBuild** - Fast production builds
- **Replit integration** - Development environment optimization

## File Handling
- **Multer** - Multipart form data handling for file uploads
- Memory storage with configurable size limits
- MIME type validation for security

## Vector Operations
- **Custom in-memory vector store** - Similarity search and clustering
- Cosine similarity calculations for semantic matching
- K-means clustering implementation for content organization