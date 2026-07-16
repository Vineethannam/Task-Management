import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, testidPrefix = "pagination" }) {
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = new Set([1, totalPages, page - 1, page, page + 1]);
    return Array.from(nums).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card flex-wrap gap-3" data-testid={testidPrefix}>
      <div className="text-xs text-muted-foreground font-mono">
        Showing <span className="font-semibold text-foreground">{from}</span> to <span className="font-semibold text-foreground">{to}</span> of <span className="font-semibold text-foreground">{total}</span> Results
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[70px]" data-testid={`${testidPrefix}-page-size`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            data-testid={`${testidPrefix}-prev`}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {pageNumbers().map((n, i, arr) => {
            const prev = arr[i - 1];
            const gap = prev && n - prev > 1;
            return (
              <div key={n} className="flex items-center gap-1">
                {gap && <span className="text-muted-foreground text-xs">…</span>}
                <Button
                  variant={n === page ? "default" : "outline"}
                  size="icon" className="h-8 w-8 text-xs"
                  onClick={() => onPageChange(n)}
                  data-testid={`${testidPrefix}-page-${n}`}
                >
                  {n}
                </Button>
              </div>
            );
          })}
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            data-testid={`${testidPrefix}-next`}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
