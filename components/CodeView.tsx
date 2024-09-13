import { Card, CardContent } from "@/components/ui/card";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";
import { Loader2 } from "lucide-react";

export function CodeView({
  code,
  isGeneratingCode,
}: {
  code: string;
  isGeneratingCode: boolean;
}) {
  return (
    <Card className="bg-gray-900 border border-gray-700 h-full max-h-[82vh] flex-grow rounded-lg shadow-lg">
      <CardContent className="p-0 h-full overflow-auto relative">
        {isGeneratingCode && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}
        <Editor
          value={code}
          onValueChange={() => {}}
          highlight={(code: string) =>
            highlight(code, languages.python, "python")
          }
          padding={16}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: "100%",
            overflow: "auto",
          }}
          readOnly={true}
        />
      </CardContent>
    </Card>
  );
}
