import type { LetterEditorInstance } from '../LetterEditor';

/**
 * Put a block where the writer is: replace the empty line the cursor is on,
 * otherwise add it right after the cursor's block.
 */
export function insertAtCursor(editor: LetterEditorInstance, block: Record<string, unknown>) {
  const cur = editor.getTextCursorPosition().block;
  const emptyLine = cur.type === 'paragraph' && Array.isArray(cur.content) && cur.content.length === 0;
  let targetId = cur.id;
  if (emptyLine) editor.updateBlock(cur, block as never);
  else targetId = editor.insertBlocks([block as never], cur, 'after')[0].id;
  editor.focus();
  try {
    editor.setTextCursorPosition(targetId, 'end');
  } catch {
    // images/embeds have no text to put a cursor in
  }
}
