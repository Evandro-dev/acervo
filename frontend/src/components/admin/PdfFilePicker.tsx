import { DocumentFilePicker } from "@/components/admin/DocumentFilePicker";

type PdfFilePickerProps = {
  description: string;
  disabled?: boolean;
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  onRemove?: () => void;
  selectedFile?: File | null;
  title: string;
};

export function PdfFilePicker({
  description,
  disabled = false,
  multiple = false,
  onFilesChange,
  onRemove,
  selectedFile,
  title,
}: PdfFilePickerProps) {
  return (
    <DocumentFilePicker
      accept="application/pdf,.pdf"
      description={description}
      disabled={disabled}
      multiple={multiple}
      onFilesChange={onFilesChange}
      onRemove={onRemove}
      removeAriaLabel="Remover PDF selecionado"
      replaceLabel="Trocar PDF"
      selectedFile={selectedFile}
      title={title}
    />
  );
}
