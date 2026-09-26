'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Confirmación para acciones que cambian datos de forma visible (eliminar, finalizar).
export function Confirmar({ abierto, titulo, descripcion, accion, peligro, onConfirmar, onCerrar }: { abierto: boolean, titulo: string, descripcion: React.ReactNode, accion: string, peligro?: boolean, onConfirmar: () => void, onCerrar: () => void }) {
  return <Dialog open={abierto} onOpenChange={o => !o && onCerrar()}>
    <DialogContent className="bg-white sm:max-w-md">
      <DialogHeader><DialogTitle className="text-lg">{titulo}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
        <Button variant={peligro ? 'destructive' : 'default'} onClick={() => { onCerrar(); onConfirmar() }} className={peligro ? 'bg-peligro text-white hover:bg-peligro/90' : 'bg-dte-petroleo hover:bg-dte-petroleo-oscuro'}>{accion}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
