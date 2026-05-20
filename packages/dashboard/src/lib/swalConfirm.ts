import Swal from "sweetalert2";

export type ConfirmDangerOptions = {
  title: string;
  text: string;
  confirmText: string;
  cancelText: string;
};

/** SweetAlert2 “are you sure?” for destructive actions (e.g. delete). */
export async function confirmDanger(opts: ConfirmDangerOptions): Promise<boolean> {
  const rtl = document.documentElement.getAttribute("dir") === "rtl";
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    iconColor: isDark ? "#fb7185" : "#e11d48",
    showCancelButton: true,
    confirmButtonText: opts.confirmText,
    cancelButtonText: opts.cancelText,
    reverseButtons: rtl,
    focusCancel: true,
    confirmButtonColor: "#be123c",
    cancelButtonColor: "#64748b",
    buttonsStyling: true,
    customClass: {
      popup: "swal-burqan",
      confirmButton: "swal-burqan-confirm",
      cancelButton: "swal-burqan-cancel",
    },
  });

  return res.isConfirmed;
}

/** SweetAlert2 confirm before saving (e.g. van inventory). */
export async function confirmSave(opts: ConfirmDangerOptions): Promise<boolean> {
  const rtl = document.documentElement.getAttribute("dir") === "rtl";
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "question",
    iconColor: isDark ? "#2dd4bf" : "#0d9488",
    showCancelButton: true,
    confirmButtonText: opts.confirmText,
    cancelButtonText: opts.cancelText,
    reverseButtons: rtl,
    focusCancel: true,
    confirmButtonColor: "#0d9488",
    cancelButtonColor: "#64748b",
    buttonsStyling: true,
    customClass: {
      popup: "swal-burqan",
      confirmButton: "swal-burqan-confirm",
      cancelButton: "swal-burqan-cancel",
    },
  });

  return res.isConfirmed;
}
