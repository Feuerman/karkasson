<template>
  <div class="checkbox-wrapper">
    <input type="checkbox" :disabled="disabled" :checked="modelValue" />
    <div class="checkbox"></div>
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
  },
}
</script>

<style scoped lang="scss">
.checkbox-wrapper {
  display: flex;
  align-items: center;
  position: relative;

  &.checked {
    .checkbox {
      background-color: currentColor;
    }

    .checkbox:after {
      display: block;
    }
  }

  .checkbox {
    z-index: 50;
    position: relative;
    width: 20px;
    height: 20px;
    background-color: #ccc;
    border-radius: 50%;
    margin-right: 10px;
    cursor: pointer;
    transition: transform 0.2s ease;

    &:after {
      z-index: 50;
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 10px;
      height: 10px;
      background-color: #fff;
      border-radius: 50%;
      display: none;
    }
  }

  input {
    z-index: 100;
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
    width: 20px;
    height: 20px;
    &:checked + .checkbox {
      background-color: currentColor;
    }

    &:checked + .checkbox:after {
      display: block;
    }

    &:hover {
      cursor: pointer;
      & + .checkbox {
        transform: scale(1.2);
      }
    }

    &:disabled {
      cursor: not-allowed;
      & + .checkbox {
        transform: scale(1);
      }
    }
  }
}
</style>
