<template>
  <div class="relative flex items-center">
    <input
      :id="id"
      type="checkbox"
      :disabled="disabled"
      :checked="modelValue"
      class="peer absolute left-0 top-0 z-[100] h-5 w-5 cursor-pointer opacity-0 disabled:cursor-not-allowed"
    />
    <div
      class="relative z-50 mr-2.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[#ccc] transition-transform duration-200 after:absolute after:left-1/2 after:top-1/2 after:h-2.5 after:w-2.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-surface after:content-[''] after:hidden peer-checked:bg-current peer-checked:after:block peer-hover:scale-[1.2] peer-disabled:scale-100 peer-disabled:cursor-not-allowed"
    ></div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'PlayersListInputCheckbox',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    id: {
      type: String,
      default: '',
    },
  },
}
</script>
