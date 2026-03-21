import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      expand={false}
      duration={4000}
      toastOptions={{
        style: { fontSize: "14px" },
        classNames: {
          toast: "font-medium shadow-lg",
          success: "!bg-emerald-50 !text-emerald-900 !border-emerald-200",
          error: "!bg-red-50 !text-red-900 !border-red-200",
          warning: "!bg-amber-50 !text-amber-900 !border-amber-200",
          info: "!bg-blue-50 !text-blue-900 !border-blue-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
