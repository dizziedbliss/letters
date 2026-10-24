import React from 'react';
import { FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from '@blocknote/react';
import { FontSelect, GlowPicker, InkPicker, LooksSelect, SizeSelect } from './ToolbarExtras';

/** BlockNote's formatting toolbar plus Looks, fonts, sizes and any-colour pickers. Used by letters and the intro page. */
export const RichToolbar: React.FC = () => (
  <FormattingToolbarController
    formattingToolbar={() => (
      <FormattingToolbar>
        <LooksSelect key="looks" />
        {getFormattingToolbarItems().filter((item) => !String(item.key).toLowerCase().includes('nest'))}
        <FontSelect key="font" />
        <SizeSelect key="size" />
        <InkPicker key="ink" />
        <GlowPicker key="glow" />
      </FormattingToolbar>
    )}
  />
);

export default RichToolbar;
