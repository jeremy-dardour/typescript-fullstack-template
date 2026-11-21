import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '@/api/hooks/use-items';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ItemFormDialog } from './item-form-dialog';

export function ItemsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data: itemsPage, isLoading, isFetching, isError } = useGetItems(page);
  const items = itemsPage?.data;
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [createOpen, setCreateOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const editItem = items?.find((item) => item.id === editItemId);
  const totalPages = Math.max(1, itemsPage?.total_pages ?? 1);

  if (itemsPage && page > totalPages) setPage(totalPages);

  const handleCreate = (data: { name: string; description?: string }) => {
    createItem.mutate(
      { body: data },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setPage(1);
        },
      },
    );
  };

  const handleUpdate = (data: { name: string; description?: string }) => {
    if (!editItem) return;
    updateItem.mutate(
      { params: { path: { id: editItem.id } }, body: data },
      { onSuccess: () => setEditItemId(null) },
    );
  };

  const handleDelete = (id: string) => {
    if (!globalThis.confirm(t('items.confirmDelete'))) return;
    deleteItem.mutate({ params: { path: { id } } });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('items.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t('items.create')}</Button>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : isError ? (
        <p>{t('items.table.error')}</p>
      ) : items?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('items.table.header.name')}</TableHead>
              <TableHead>{t('items.table.header.description')}</TableHead>
              <TableHead>{t('items.table.header.createdAt')}</TableHead>
              <TableHead className="w-[120px]">
                {t('items.table.header.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.description ?? '—'}</TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditItemId(item.id)}
                    >
                      {t('items.edit')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      {t('items.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t('items.table.noData')}</p>
      )}

      {itemsPage && (
        <nav
          aria-label={t('items.pagination.label')}
          className="flex flex-wrap items-center gap-3"
        >
          <Button
            variant="outline"
            disabled={page === 1 || isFetching}
            onClick={() => setPage(page - 1)}
          >
            {t('items.pagination.previous')}
          </Button>
          <p aria-live="polite">
            {t('items.pagination.status', {
              page,
              pages: totalPages,
              total: itemsPage.total,
            })}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage(page + 1)}
          >
            {t('items.pagination.next')}
          </Button>
        </nav>
      )}

      <ItemFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        title={t('items.create')}
        isLoading={createItem.isPending}
      />

      {editItem && (
        <ItemFormDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditItemId(null);
          }}
          onSubmit={handleUpdate}
          title={t('items.edit')}
          defaultValues={editItem}
          isLoading={updateItem.isPending}
        />
      )}
    </div>
  );
}
