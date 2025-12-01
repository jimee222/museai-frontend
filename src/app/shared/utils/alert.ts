import Swal from 'sweetalert2';

export function showMuseAlert(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  title?: string,
  html?: string
) {
  return Swal.fire({  
    title: title ?? '',
    text: html ? undefined : message,
    html: html ?? undefined,
    icon: type,

    background: '#ddd2ab',
    color: '#ffffff',
    iconColor: '#d7b25a',
    confirmButtonColor: '#d7b25a',

    customClass: {
      popup: 'muse-alert-popup',
      title: 'muse-alert-title',
      htmlContainer: 'muse-alert-text'
    }
  });
}
