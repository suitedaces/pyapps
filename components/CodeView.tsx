import { Card, CardContent } from "@/components/ui/card";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';
import { Loader2 } from 'lucide-react';

export function CodeView({ code, isProcessing }: { code: string, isProcessing: boolean }) {
  return (
    <Card className="bg-gray-900 border border-gray-700 h-full max-h-[80vh] flex-grow rounded-lg shadow-lg">
      <CardContent className="p-0 h-full overflow-auto relative">
        {isProcessing && (
          <div className="absolute top-2 right-2 flex items-center bg-gray-800 rounded-full px-2 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
            <span className="text-xs text-blue-500">Generating code...</span>
          </div>
        )}
        <Editor
          value={code}
          onValueChange={() => {}}
          highlight={(code: string) => highlight(code, languages.python, 'python')}
          padding={16}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: '100%',
            overflow: 'auto',
          }}
          readOnly={true}
        />
      </CardContent>
    </Card>
  );
}