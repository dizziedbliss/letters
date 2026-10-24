import React from 'react';
import { FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from '@blocknote/react';
import { FontSelect, GlowPicker, InkPicker, SizeSelect } from './ToolbarExtras';

// Not needed on these pages: nesting, and file chores (rename/download/preview) on images
const HIDDEN = ['nest', 'rename', 'download', 'preview', 'replace'];

/** BlockNote's formatting toolbar plus fonts, sizes and any-colour pickers. Used by letters and the intro page. */
export const RichToolbar: React.FC = () => (
  <FormattingToolbarController
    formattingToolbar={() => (
      <FormattingToolbar>
        {getFormattingToolbarItems().filter((item) => !HIDDEN.some((h) => String(item.key).toLowerCase().includes(h)))}
        <FontSelect key="font" />
        <SizeSelect key="size" />
        <InkPicker key="ink" />
        <GlowPicker key="glow" />
      </FormattingToolbar>
    )}
  />
);

export default RichToolbar;
