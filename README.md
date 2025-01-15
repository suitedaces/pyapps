# py_apps - Build & Share Data Apps in Seconds

py_apps is a web app that enables users to create and share data apps with no coding knowledge.

## 🌟 Features

- **AI-Powered App Creation**: Create Streamlit apps through natural language conversation with Claude 3
- **File Management**: Upload and analyze CSV, JSON, and text files
- **Version Control**: Track and manage different versions of your Streamlit apps
- **Real-time Preview**: See your Streamlit apps in action as you develop them
- **Dark Mode Support**: Full dark mode support for comfortable viewing
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 18, TailwindCSS
- **Backend**: Next.js API Routes, Supabase
- **AI**: Claude 3 (Anthropic)
- **Data Processing**: PapaParse, SheetJS
- **Authentication**: Supabase Auth
- **Storage**: AWS S3
- **Sandbox**: E2B Code Interpreter
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: Zustand
- **Styling**: TailwindCSS, CSS Modules

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- AWS S3 bucket
- E2B account
- Anthropic API key

### Environment Variables

Create a `.env` file with the following variables:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
E2B_API_KEY=your_e2b_api_key
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/py_apps.git
cd py_apps
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Run the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   ├── apps/            # App-related pages
│   ├── auth/            # Authentication pages
│   ├── chat/            # Chat interface
│   └── files/           # File management
├── components/          # React components
├── contexts/            # React contexts
├── lib/                 # Utility functions and types
│   ├── stores/         # Zustand stores
│   ├── supabase/       # Supabase client
│   └── tools/          # AI tools
├── public/             # Static assets
└── scripts/            # Helper scripts
```

## 🔒 Authentication

The application uses Supabase Authentication with the following features:
- Google OAuth
- Email/Password authentication
- Password reset functionality
- Session management

## 💾 Database Schema

Key tables in the Supabase database:
- `apps`: Stores application metadata
- `app_versions`: Tracks different versions of apps
- `chats`: Stores chat conversations
- `messages`: Contains chat messages
- `files`: Manages uploaded files
- `users`: User information