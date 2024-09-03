import { Card, CardContent } from "@/components/ui/card";
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';

export function CodeView({ code }: { code: string }) {
  return (
    <Card className="bg-gray-900 border border-gray-700 h-full max-h-[80vh] flex-grow rounded-lg shadow-lg">
      <CardContent className="p-0 h-full overflow-auto">
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
