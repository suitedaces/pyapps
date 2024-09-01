import { Card, CardContent } from "@/components/ui/card"
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';
import { useEffect, useState } from 'react';

export function CodeView({ code }: { code: string }) {
  const [displayedCode, setDisplayedCode] = useState(code);

  useEffect(() => {
    setDisplayedCode(code);
  }, [code]);

  return (
    <Card>
      <CardContent className="p-0">
        <Editor
          value={displayedCode}
          onValueChange={() => {}}
          highlight={(code) => highlight(code, languages.python, 'python')}
          padding={10}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 12,
            height: '600px',
            overflow: 'auto',
          }}
          readOnly={true}
        />
      </CardContent>
    </Card>
  )
}