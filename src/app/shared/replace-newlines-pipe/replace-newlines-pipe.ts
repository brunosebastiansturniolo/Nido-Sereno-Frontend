import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'replaceNewlines',
  standalone: true
})
export class ReplaceNewlinesPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value.replace(/\n/g, '<br>');
  }
}
