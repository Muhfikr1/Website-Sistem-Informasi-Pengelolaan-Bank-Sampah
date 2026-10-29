import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

interface TodoItem {
  id: string | number;
  name?: string;
  title?: string;
}

export default async function TodosPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from("todos").select();

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Daftar Todos (Supabase SSR)</h1>
      <ul className="list-disc pl-5 space-y-1">
        {(todos as TodoItem[] | null)?.map((todo) => (
          <li key={todo.id}>{todo.name || todo.title || String(todo.id)}</li>
        ))}
        {(!todos || todos.length === 0) && (
          <li className="text-neutral-500">Belum ada data di tabel todos.</li>
        )}
      </ul>
    </div>
  );
}
