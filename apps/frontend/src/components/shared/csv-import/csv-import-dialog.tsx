'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { ImportResult, importApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'cars' | 'customers';
  invalidateKey: string;
}

const TEMPLATES: Record<'cars' | 'customers', { headers: string[]; example: string[] }> = {
  cars: {
    headers: ['make', 'model', 'year', 'licensePlate', 'vin', 'category', 'branchCode', 'transmission', 'fuelType', 'seats', 'mileage'],
    example: ['Toyota', 'Camry', '2023', 'ABC-1234', 'JT2BF22K1X0123456', 'Sedan', 'DXB01', 'AUTOMATIC', 'PETROL', '5', '15000'],
  },
  customers: {
    headers: ['fullName', 'email', 'phone', 'nationality'],
    example: ['Ahmed Al Mansouri', 'ahmed@example.com', '+971501234567', 'AE'],
  },
};

export function CsvImportDialog({ open, onOpenChange, kind, invalidateKey }: CsvImportDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const template = TEMPLATES[kind];

  const { mutate: runImport, isPending } = useMutation({
    mutationFn: (f: File) => kind === 'cars' ? importApi.cars(f) : importApi.customers(f),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      toast({ title: `Import complete: ${res.created} created, ${res.skipped} skipped` });
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  const downloadTemplate = () => {
    const csv = [template.headers.join(','), template.example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import {kind === 'cars' ? 'Cars' : 'Customers'} from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template download */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Download template</p>
              <p className="text-xs text-muted-foreground mt-0.5">CSV with required columns</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Template
            </Button>
          </div>

          {/* File drop zone */}
          <div
            className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f?.name.endsWith('.csv')) { setFile(f); setResult(null); }
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); } }}
            />
            {file ? (
              <>
                <FileText className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a CSV file here, or <span className="text-primary underline">browse</span>
                </p>
              </>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">{result.created} created</span>
                <span className="text-muted-foreground">{result.skipped} skipped</span>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-xs text-muted-foreground">…and {result.errors.length - 5} more errors</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button disabled={!file || isPending} onClick={() => file && runImport(file)}>
              <Upload className="h-4 w-4 mr-1" />
              {isPending ? 'Importing…' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
